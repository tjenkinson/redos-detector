import {
  buildCharacterReader,
  CharacterReader,
} from '../character-reader/character-reader-level-0';
import { join, joinArray } from '../character-reader/join';
import { buildNullCharacterReader } from './null';
import { CharacterReaderLevel2Stack } from '../character-reader/character-reader-level-2';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';
import { Quantifier } from 'regjsparser';

export type QuantifierIterations = ReadonlyMap<Quantifier<MyFeatures>, number>;
export type StackQuantifierEntry = Readonly<{
  iteration: number;
  quantifier: Quantifier<MyFeatures>;
  type: 'quantifier';
}>;
export type QuantifierStack = readonly StackQuantifierEntry[];
export type QuantifiersInInfinitePortion = ReadonlySet<Quantifier<MyFeatures>>;

// TODO previously this would not be included for references. so remove for those? Exposed on api only?
export function getQuantifierStack(
  stack: CharacterReaderLevel2Stack,
): QuantifierStack {
  const quantifierStack: StackQuantifierEntry[] = [];
  for (const entry of stack) {
    if (entry.type === 'quantifier') {
      quantifierStack.push(entry);
    }
  }
  return quantifierStack;
}

// TODO previously this would not be included for references. so remove for those? maybe could not happen in reality because refernces can't have infinite lopps?
export function buildQuantifiersInInfinitePortion(
  stack: QuantifierStack,
): QuantifiersInInfinitePortion {
  return new Set(
    stack
      .filter(
        ({ iteration, quantifier }) =>
          iteration >= 1 &&
          iteration >= quantifier.min &&
          quantifier.max === undefined,
      )
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
