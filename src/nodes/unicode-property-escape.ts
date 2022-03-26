import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader-level-0';
import { buildArrayReader } from '../reader';
import { UnicodePropertyEscape } from 'regjsparser';

export function buildUnicodePropertyEscapeCharacterReader(
  node: UnicodePropertyEscape
): CharacterReader {
  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups: {
        characterClassEscapes: new Set(),
        dot: false,
        negated: node.negative,
        ranges: [],
        unicodePropertyEscapes: new Set([node.value]),
      },
      groups: new Map(),
      lookaheadStack: [],
      node,
      quantifierStack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
