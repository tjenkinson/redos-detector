import {
  buildCharacterReader,
  CharacterReader,
} from '../character-reader/character-reader-level-0';
import { join, joinArray } from '../character-reader/join';
import { buildNullCharacterReader } from './null';
import { CharacterReaderLevel2Stack } from '../character-reader/character-reader-level-2';
import { map } from '../character-reader/map';
import { mustGet } from '../map';
import { MyFeatures } from '../parse';
import { NodeExtra } from '../node-extra';
import { Quantifier } from 'regjsparser';

export type QuantifierIterations = ReadonlyMap<Quantifier<MyFeatures>, number>;
export type StackQuantifierEntry = Readonly<{
  iteration: number;
  quantifier: Quantifier<MyFeatures>;
  type: 'quantifier';
}>;
export type QuantifiersInInfinitePortion = ReadonlySet<Quantifier<MyFeatures>>;

export function buildQuantifiersInInfinitePortion(
  stack: CharacterReaderLevel2Stack,
  nodeExtra: NodeExtra,
): QuantifiersInInfinitePortion {
  const exhaustive = stack.some((entry) => {
    if (entry.type !== 'group' || entry.group.behavior !== 'normal') {
      return false;
    }

    const index = mustGet(nodeExtra.capturingGroupToIndex, entry.group);
    const hasReference = nodeExtra.reachableReferences.some(
      (reference) => reference.matchIndex === index,
    );
    return hasReference;
  });

  // if we are part of a group that is referenced then we need to include all iterations
  // because that could have an effect later where the reference is
  if (exhaustive) return new Set();

  return new Set(
    stack
      .flatMap((entry) => (entry.type === 'quantifier' ? [entry] : []))
      .filter(
        ({ iteration, quantifier }) =>
          iteration >= 1 && iteration >= quantifier.min,
      )
      .map(({ quantifier }) => quantifier),
  );
}

export function buildQuantifierIterations(
  stack: CharacterReaderLevel2Stack,
): QuantifierIterations {
  const res: Map<Quantifier<MyFeatures>, number> = new Map();
  stack
    .flatMap((entry) => (entry.type === 'quantifier' ? [entry] : []))
    .forEach(({ iteration, quantifier }) => res.set(quantifier, iteration));
  return res;
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
              return {
                ...value,
                stack: [
                  {
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
