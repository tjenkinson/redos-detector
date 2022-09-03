import {
  buildCharacterReader,
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
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

export const characterReaderLevelNewTypeSplit: unique symbol = Symbol(
  'characterReaderLevel1TypeSplit'
);

export const characterReaderLevelNewTypeEntry: unique symbol = Symbol(
  'characterReaderLevelNewTypeEntry'
);

export type CharacterReaderLevelNewValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevelNew;
  type: typeof characterReaderLevelNewTypeSplit;
};

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

export type CharacterReaderLevelNewValueEntry = Readonly<
  {
    preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
    stack: Stack;
    type: typeof characterReaderLevelNewTypeEntry;
  } & (
    | {
        characterGroups: CharacterGroups;
        node:
          | CharacterClass
          | CharacterClassEscape
          | Dot
          | UnicodePropertyEscape
          | Value;
        subType: 'groups';
      }
    | {
        node: Reference;
        referenceIndex: number;
        subType: 'reference';
      }
  )
>;

export type CharacterReaderLevelNewValue = Readonly<
  CharacterReaderLevelNewValueEntry | CharacterReaderLevelNewValueSplit
>;
export type CharacterReaderLevelNewReturnValue = Readonly<{
  bounded: boolean;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
}>;

export type CharacterReaderLevelNew = Reader<
  CharacterReaderLevelNewValue,
  CharacterReaderLevelNewReturnValue
>;
/**
 * Returns a `CharacterReaderLevelNew` (TODO) which builds on top of
 * `CharacterReaderLevel0` adds a `preceedingZeroWidthEntries` property
 * and makes every result map to a character.
 */
export function buildCharacterReaderLevelNew(
  node: MyRootNode
): CharacterReaderLevelNew {
  const startThread = function* (
    reader: CharacterReader,
    preceedingZeroWidthEntries: readonly ZeroWidthEntry[]
  ): CharacterReaderLevelNew {
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
                type: characterReaderLevelNewTypeEntry,
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
                type: characterReaderLevelNewTypeEntry,
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
            reader: (): CharacterReaderLevelNew =>
              startThread(value.reader(), _preceedingZeroWidthEntries),
            type: characterReaderLevelNewTypeSplit,
          };
          break;
        }
      }
    }
    return { bounded: false, preceedingZeroWidthEntries };
  };

  return startThread(buildCharacterReader(node), []);
}
