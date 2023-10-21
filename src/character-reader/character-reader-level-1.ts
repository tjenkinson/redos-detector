import {
  buildCharacterReader,
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
  CharacterReaderValueSplitSubType,
  Stack,
} from './character-reader-level-0';
import {
  CharacterClass,
  CharacterClassEscape,
  Dot,
  Reference,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import { Reader, ReaderResult } from '../reader';
import { CharacterGroups } from '../character-groups';
import { MyRootNode } from '../parse';

export const characterReaderLevel1TypeSplit: unique symbol = Symbol(
  'characterReaderLevel2TypeSplit',
);

export const characterReaderLevel1TypeEntry: unique symbol = Symbol(
  'characterReaderLevel1TypeEntry',
);

export type CharacterReaderLevel1ValueSplit = Readonly<{
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel1;
  subType: CharacterReaderValueSplitSubType;
  type: typeof characterReaderLevel1TypeSplit;
}>;

export type ZeroWidthEntry = Readonly<
  | {
      offset: number;
      type: 'null';
    }
  | {
      offset: number;
      type: 'start';
    }
>;

export type CharacterReaderLevel1ValueEntryBase = Readonly<{
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  stack: Stack;
  type: typeof characterReaderLevel1TypeEntry;
}>;

export type CharacterReaderLevel1ValueEntryGroups = Readonly<
  CharacterReaderLevel1ValueEntryBase & {
    characterGroups: CharacterGroups;
    node:
      | CharacterClass
      | CharacterClassEscape
      | Dot
      | UnicodePropertyEscape
      | Value;
    subType: 'groups';
  }
>;

export type CharacterReaderLevel1ValueEntryReference = Readonly<
  CharacterReaderLevel1ValueEntryBase & {
    node: Reference;
    referenceIndex: number;
    subType: 'reference';
  }
>;

export type CharacterReaderLevel1ValueEntry = Readonly<
  | CharacterReaderLevel1ValueEntryGroups
  | CharacterReaderLevel1ValueEntryReference
>;

export type CharacterReaderLevel1Value = Readonly<
  CharacterReaderLevel1ValueEntry | CharacterReaderLevel1ValueSplit
>;
export type CharacterReaderLevel1ReturnValue = Readonly<{
  bounded: boolean;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
}>;

export type CharacterReaderLevel1 = Reader<
  CharacterReaderLevel1Value,
  CharacterReaderLevel1ReturnValue
>;
/**
 * Returns a `CharacterReaderLevel1` which builds on top of
 * `CharacterReaderLevel0` adds a `preceedingZeroWidthEntries` property
 * and makes every result map to a character.
 */
export function buildCharacterReaderLevel1({
  caseInsensitive,
  dotAll,
  node,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: MyRootNode;
}): CharacterReaderLevel1 {
  const startThread = function* (
    reader: CharacterReader,
    preceedingZeroWidthEntries: readonly ZeroWidthEntry[],
  ): CharacterReaderLevel1 {
    let next: ReaderResult<CharacterReaderValue>;
    while (!(next = reader.next()).done) {
      switch (next.value.type) {
        case characterReaderTypeCharacterEntry: {
          switch (next.value.subType) {
            case 'groups':
              yield {
                characterGroups: next.value.characterGroups,
                node: next.value.node,
                preceedingZeroWidthEntries,
                stack: next.value.stack,
                subType: 'groups',
                type: characterReaderLevel1TypeEntry,
              };
              preceedingZeroWidthEntries = [];
              break;
            case 'reference': {
              yield {
                node: next.value.node,
                preceedingZeroWidthEntries,
                referenceIndex: next.value.referenceIndex,
                stack: next.value.stack,
                subType: next.value.subType,
                type: characterReaderLevel1TypeEntry,
              };
              preceedingZeroWidthEntries = [];
              break;
            }
            case 'end': {
              return {
                bounded: next.value.bounded,
                preceedingZeroWidthEntries,
              };
            }
            case 'null': {
              preceedingZeroWidthEntries = [
                ...preceedingZeroWidthEntries,
                { offset: next.value.offset, type: 'null' },
              ];
              break;
            }
            case 'start': {
              preceedingZeroWidthEntries = [
                ...preceedingZeroWidthEntries,
                { offset: next.value.offset, type: 'start' },
              ];
              break;
            }
          }
          break;
        }
        case characterReaderTypeSplit: {
          const value = next.value;
          const _preceedingZeroWidthEntries = preceedingZeroWidthEntries;
          yield {
            reader: (): CharacterReaderLevel1 =>
              startThread(value.reader(), _preceedingZeroWidthEntries),
            subType: value.subType,
            type: characterReaderLevel1TypeSplit,
          };
          break;
        }
      }
    }
    return { bounded: false, preceedingZeroWidthEntries };
  };

  return startThread(
    buildCharacterReader({ caseInsensitive, dotAll, node }),
    [],
  );
}
