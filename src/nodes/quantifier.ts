import {
  buildCharacterReader,
  CharacterReader,
} from '../character-reader/character-reader-level-0';
import { join, joinArray } from '../character-reader/join';
import { buildNullCharacterReader } from './null';
import { GroupsMutable } from './group';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';
import { Quantifier } from 'regjsparser';

export type QuantifierIterations = ReadonlyMap<Quantifier<MyFeatures>, number>;
export type QuantifierStackEntry = Readonly<{
  inInfinitePortion: boolean;
  iteration: number;
  quantifier: Quantifier<MyFeatures>;
}>;
export type QuantifierStack = readonly QuantifierStackEntry[];
export type QuantifiersInInfinitePortion = ReadonlySet<Quantifier<MyFeatures>>;

export function buildQuantifiersInInfinitePortion(
  stack: QuantifierStack
): QuantifiersInInfinitePortion {
  return new Set(
    stack
      .filter(({ inInfinitePortion }) => inInfinitePortion)
      .map(({ quantifier }) => quantifier)
  );
}

export function buildQuantifierIterations(
  stack: QuantifierStack
): QuantifierIterations {
  const res: Map<Quantifier<MyFeatures>, number> = new Map();
  stack.forEach(({ iteration, quantifier }) => res.set(quantifier, iteration));
  return res;
}

// "<node offset>:<iteration number or * if in infinite portion>,..."
export function buildQuantifierTrail(
  stack: QuantifierStack,
  asteriskInfinite: boolean
): string {
  return stack
    .map(({ quantifier, inInfinitePortion, iteration }) => {
      return `${quantifier.range[0]}:${
        asteriskInfinite && inInfinitePortion ? '*' : `${iteration}`
      }`;
    })
    .join(',');
}

export function buildQuantifierCharacterReader(
  node: Quantifier<MyFeatures>
): CharacterReader {
  const { min, max = Infinity } = node;
  return joinArray([
    // always emit the null first so that we always emit something in cases where the loop is empty
    (): CharacterReader => buildNullCharacterReader(node.body[0].range[0]),
    (): CharacterReader =>
      join(
        (i: number, timeSinceEmit: number) => {
          // prevent infinite loop on something like `()*`
          // > 1 so that the capturing groups are cleared with something like `(?:(a)|)*`
          if (timeSinceEmit > 1) return 'stop';
          if (i >= max) return 'stop';
          if (i >= min) return 'fork';
          return 'continue';
        },
        (i: number) => {
          return map(
            joinArray([
              ...(i > 0
                ? [
                    (): CharacterReader =>
                      buildNullCharacterReader(node.body[0].range[0]),
                  ]
                : []),
              (): CharacterReader => buildCharacterReader(node.body[0]),
            ]),
            (value) => {
              const inInfinitePortion = i >= min && i >= 1;
              const newGroups: GroupsMutable = new Map();
              for (const [group, entry] of value.groups) {
                newGroups.set(group, {
                  ...entry,
                  quantifierStack: [
                    { inInfinitePortion, iteration: i, quantifier: node },
                    ...entry.quantifierStack,
                  ],
                });
              }
              return {
                ...value,
                groups: newGroups,
                quantifierStack: [
                  { inInfinitePortion, iteration: i, quantifier: node },
                  ...value.quantifierStack,
                ],
              };
            }
          );
        }
      ),
  ]);
}
