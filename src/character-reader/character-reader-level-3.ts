import {
  BackReferenceStack,
  buildCharacterReaderLevel2,
  CharacterReaderLevel2,
  CharacterReaderLevel2ReturnValue,
  characterReaderLevel2TypeEntry,
  characterReaderLevel2TypeSplit,
  CharacterReaderLevel2Value,
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
import { CharacterReaderValueSplitSubType } from './character-reader-level-0';
import { fork } from 'forkable-iterator';
import { MyRootNode } from '../parse';
import { NodeExtra } from '../node-extra';
import { QuantifierStack } from '../nodes/quantifier';
import { ZeroWidthEntry } from './character-reader-level-1';

export const characterReaderLevel3TypeSplit: unique symbol = Symbol(
  'characterReaderLevel3TypeSplit'
);

export const characterReaderLevel3TypeEntry: unique symbol = Symbol(
  'characterReaderLevel3TypeEntry'
);

export type CharacterReaderLevel3ValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel3;
  subType: CharacterReaderValueSplitSubType;
  type: typeof characterReaderLevel3TypeSplit;
};

export type CharacterReaderLevel3ValueEntry = Readonly<{
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
  type: typeof characterReaderLevel3TypeEntry;
  // `true` if this could be nothing following this.
  // I.e. anything that didn't match would fall outside the pattern
  // the `a+` in `^a+` because a `b` would just end the match
  unbounded: boolean;
}>;

export type CharacterReaderLevel3Value = Readonly<
  CharacterReaderLevel3ValueEntry | CharacterReaderLevel3ValueSplit
>;
export type CharacterReaderLevel3ReturnValue = CharacterReaderLevel2ReturnValue;
export type CharacterReaderLevel3 = Reader<
  CharacterReaderLevel3Value,
  CharacterReaderLevel3ReturnValue
>;

function isReaderAtEnd(
  reader: ForkableReader<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >
): boolean {
  const isAtEndUnbounded = (innerReader: CharacterReaderLevel2): boolean => {
    const next = innerReader.next();
    if (next.done) {
      return next.value.type === 'end' && !next.value.bounded;
    }
    if (next.value.type === characterReaderLevel2TypeSplit) {
      return (
        isAtEndUnbounded(next.value.reader()) || isAtEndUnbounded(innerReader)
      );
    }
    return false;
  };

  return isAtEndUnbounded(fork(reader));
}

/**
 * Returns a `CharacterReaderLevel3` which does the same as
 * `CharacterReaderLevel2` but adds an `unbounded` property.
 */
export function buildCharacterReaderLevel3(
  node: MyRootNode,
  nodeExtra: NodeExtra
): CharacterReaderLevel3 {
  const startThread = function* (
    reader: ForkableReader<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >
  ): CharacterReaderLevel3 {
    let next: ReaderResult<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >;
    while (!(next = reader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderLevel2TypeEntry: {
          yield {
            backreferenceStack: value.backreferenceStack,
            characterGroups: value.characterGroups,
            groups: value.groups,
            lookaheadStack: value.lookaheadStack,
            node: value.node,
            preceedingZeroWidthEntries: value.preceedingZeroWidthEntries,
            quantifierStack: value.quantifierStack,
            type: characterReaderLevel3TypeEntry,
            unbounded: isReaderAtEnd(reader),
          };
          break;
        }
        case characterReaderLevel2TypeSplit: {
          yield {
            reader: (): CharacterReaderLevel3 =>
              startThread(buildForkableReader(value.reader())),
            subType: value.subType,
            type: characterReaderLevel3TypeSplit,
          };
          break;
        }
      }
    }
    return next.value;
  };

  return startThread(
    buildForkableReader(buildCharacterReaderLevel2(node, nodeExtra))
  );
}
