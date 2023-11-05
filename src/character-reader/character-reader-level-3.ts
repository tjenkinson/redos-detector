import {
  BackReferenceStack,
  buildCharacterReaderLevel2,
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
import { isUnboundedReader, IsUnboundedReader } from '../is-unbounded-reader';
import { CharacterGroups } from '../character-groups';
import { CharacterReaderValueSplitSubType } from './character-reader-level-0';
import { fork } from 'forkable-iterator';
import { MyRootNode } from '../parse';
import { NodeExtra } from '../node-extra';
import { QuantifierStack } from '../nodes/quantifier';
import { ZeroWidthEntry } from './character-reader-level-1';

export const characterReaderLevel3TypeSplit: unique symbol = Symbol(
  'characterReaderLevel3TypeSplit',
);

export const characterReaderLevel3TypeEntry: unique symbol = Symbol(
  'characterReaderLevel3TypeEntry',
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
  // reader returning `true` if this could be nothing following this.
  // I.e. anything that didn't match would fall outside the pattern
  // the `a+` in `^a+` because a `b` would just end the match
  isReaderUnbounded: () => IsUnboundedReader;
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
}>;

export type CharacterReaderLevel3Value = Readonly<
  CharacterReaderLevel3ValueEntry | CharacterReaderLevel3ValueSplit
>;
export type CharacterReaderLevel3ReturnValue = CharacterReaderLevel2ReturnValue;
export type CharacterReaderLevel3 = Reader<
  CharacterReaderLevel3Value,
  CharacterReaderLevel3ReturnValue
>;

/**
 * Returns a `CharacterReaderLevel3` which does the same as
 * `CharacterReaderLevel2` but adds an `unbounded` property.
 */
export function buildCharacterReaderLevel3({
  caseInsensitive,
  dotAll,
  node,
  nodeExtra,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: MyRootNode;
  nodeExtra: NodeExtra;
}): CharacterReaderLevel3 {
  const startThread = function* (
    reader: ForkableReader<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >,
  ): CharacterReaderLevel3 {
    let next: ReaderResult<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >;
    while (!(next = reader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderLevel2TypeSplit: {
          yield {
            reader: (): CharacterReaderLevel3 =>
              startThread(buildForkableReader(value.reader())),
            subType: value.subType,
            type: characterReaderLevel3TypeSplit,
          };
          break;
        }
        case characterReaderLevel2TypeEntry: {
          const forked = fork(reader);

          yield {
            backreferenceStack: value.backreferenceStack,
            characterGroups: value.characterGroups,
            groups: value.groups,
            isReaderUnbounded: () => isUnboundedReader(forked),
            lookaheadStack: value.lookaheadStack,
            node: value.node,
            preceedingZeroWidthEntries: value.preceedingZeroWidthEntries,
            quantifierStack: value.quantifierStack,
            type: characterReaderLevel3TypeEntry,
          };
          break;
        }
      }
    }
    return next.value;
  };

  return startThread(
    buildForkableReader(
      buildCharacterReaderLevel2({ caseInsensitive, dotAll, node, nodeExtra }),
    ),
  );
}
