import {
  buildCharacterReader,
  CharacterReader,
  Stack,
} from '../character-reader/character-reader-level-0';
import { join, joinArray } from '../character-reader/join';
import { buildNullCharacterReader } from './null';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';
import { Quantifier } from 'regjsparser';

export type QuantifierIterations = ReadonlyMap<Quantifier<MyFeatures>, number>;
export type StackQuantifierEntry = Readonly<{
  inInfinitePortion: boolean;
  iteration: number;
  quantifier: Quantifier<MyFeatures>;
  type: 'quantifier';
}>;
export type QuantifierStack = readonly StackQuantifierEntry[];
export type QuantifiersInInfinitePortion = ReadonlySet<Quantifier<MyFeatures>>;

export function getQuantifierStack(stack: Stack): QuantifierStack {
  const quantifierStack: StackQuantifierEntry[] = [];
  for (const entry of stack) {
    if (entry.type === 'quantifier') {
      quantifierStack.push(entry);
    }
  }
  return quantifierStack;
}

export function buildQuantifiersInInfinitePortion(
  stack: QuantifierStack,
): QuantifiersInInfinitePortion {
  return new Set(
    stack
      .filter(({ inInfinitePortion }) => inInfinitePortion)
      .map(({ quantifier }) => quantifier),
  );
}

export function buildQuantifierIterations(
  stack: QuantifierStack,
): QuantifierIterations {
  const res: Map<Quantifier<MyFeatures>, number> = new Map();
  stack.forEach(({ iteration, quantifier }) => res.set(quantifier, iteration));
  return res;
}

// "<node offset>:<iteration number or * if in infinite portion>,..."
export function buildQuantifierTrail(
  stack: QuantifierStack,
  asteriskInfinite: boolean,
): string {
  return stack
    .map(({ quantifier, inInfinitePortion, iteration }) => {
      return `${quantifier.range[0]}:${
        asteriskInfinite && inInfinitePortion ? '*' : `${iteration}`
      }`;
    })
    .join(',');
}

export function buildQuantifierCharacterReader({
  caseInsensitive,
  dotAll,
  node,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: Quantifier<MyFeatures>;
}): CharacterReader {
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
              (): CharacterReader =>
                buildCharacterReader({
                  caseInsensitive,
                  dotAll,
                  node: node.body[0],
                }),
            ]),
            (value) => {
              const inInfinitePortion = i >= min && i >= 1 && max === Infinity;
              return {
                ...value,
                stack: [
                  {
                    inInfinitePortion,
                    iteration: i,
                    quantifier: node,
                    type: 'quantifier',
                  },
                  ...value.stack,
                ],
              };
            },
          );
        },
      ),
  ]);
}
