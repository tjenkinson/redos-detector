import {
  BackReferenceStack,
  buildCharacterReaderLevel1,
  CharacterReaderLevel1,
  CharacterReaderLevel1ReturnValue,
  characterReaderLevel1TypeEntry,
  characterReaderLevel1TypeSplit,
  CharacterReaderLevel1Value,
} from './character-reader-level-2';
import {
  buildForkableReader,
  ForkableReader,
  Reader,
  ReaderResult,
} from '../reader';
import {
  CharacterClass,
  CharacterClassEscape,
  Dot,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import { Groups, LookaheadStack } from '../nodes/group';
import { CharacterGroups } from '../character-groups';
import { fork } from 'forkable-iterator';
import { MyRootNode } from '../parse';
import { NodeExtra } from '../node-extra';
import { QuantifierStack } from '../nodes/quantifier';
import { ZeroWidthEntry } from './character-reader-level-new';

export const characterReaderLevel2TypeSplit: unique symbol = Symbol(
  'characterReaderLevel2TypeSplit'
);

export const characterReaderLevel2TypeEntry: unique symbol = Symbol(
  'characterReaderLevel2TypeEntry'
);

export type CharacterReaderLevel2ValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel2;
  type: typeof characterReaderLevel2TypeSplit;
};

export type CharacterReaderLevel2ValueEntry = Readonly<{
  backreferenceStack: BackReferenceStack;
  characterGroups: CharacterGroups;
  groups: Groups;
  lookaheadStack: LookaheadStack;
  node:
    | CharacterClass
    | CharacterClassEscape
    | Dot
    | UnicodePropertyEscape
    | Value;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  quantifierStack: QuantifierStack;
  type: typeof characterReaderLevel2TypeEntry;
  // `true` if this could be nothing following this.
  // I.e. anything that didn't match would fall outside the pattern
  // the `a+` in `^a+` because a `b` would just end the match
  unbounded: boolean;
}>;

export type CharacterReaderLevel2Value = Readonly<
  CharacterReaderLevel2ValueEntry | CharacterReaderLevel2ValueSplit
>;
export type CharacterReaderLevel2ReturnValue = CharacterReaderLevel1ReturnValue;
export type CharacterReaderLevel2 = Reader<
  CharacterReaderLevel2Value,
  CharacterReaderLevel2ReturnValue
>;

function isReaderAtEnd(
  reader: ForkableReader<
    CharacterReaderLevel1Value,
    CharacterReaderLevel1ReturnValue
  >
): boolean {
  const isAtEndUnbounded = (innerReader: CharacterReaderLevel1): boolean => {
    const next = innerReader.next();
    if (next.done) {
      return next.value.type === 'end' && !next.value.bounded;
    }
    if (next.value.type === characterReaderLevel1TypeSplit) {
      return (
        isAtEndUnbounded(next.value.reader()) || isAtEndUnbounded(innerReader)
      );
    }
    return false;
  };

  return isAtEndUnbounded(fork(reader));
}

/**
 * Returns a `CharacterReaderLevel2` which does the same as
 * `CharacterReaderLevel1` but adds a `unbounded` property.
 */
export function buildCharacterReaderLevel2(
  node: MyRootNode,
  nodeExtra: NodeExtra
): CharacterReaderLevel2 {
  const startThread = function* (
    reader: ForkableReader<
      CharacterReaderLevel1Value,
      CharacterReaderLevel1ReturnValue
    >
  ): CharacterReaderLevel2 {
    let next: ReaderResult<
      CharacterReaderLevel1Value,
      CharacterReaderLevel1ReturnValue
    >;
    while (!(next = reader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderLevel1TypeEntry: {
          yield {
            backreferenceStack: value.backreferenceStack,
            characterGroups: value.characterGroups,
            groups: value.groups,
            lookaheadStack: value.lookaheadStack,
            node: value.node,
            preceedingZeroWidthEntries: value.preceedingZeroWidthEntries,
            quantifierStack: value.quantifierStack,
            type: characterReaderLevel2TypeEntry,
            unbounded: isReaderAtEnd(reader),
          };
          break;
        }
        case characterReaderLevel1TypeSplit: {
          yield {
            reader: (): CharacterReaderLevel2 =>
              startThread(buildForkableReader(value.reader())),
            type: characterReaderLevel2TypeSplit,
          };
          break;
        }
      }
    }
    return next.value;
  };

  return startThread(
    buildForkableReader(buildCharacterReaderLevel1(node, nodeExtra))
  );
}
