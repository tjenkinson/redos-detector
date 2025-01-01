import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader-level-0';
import { buildArrayReader } from '../reader';
import { UnicodePropertyEscape } from 'regjsparser';

export function buildUnicodePropertyEscapeCharacterReader(
  node: UnicodePropertyEscape,
): CharacterReader {
  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups: {
        ranges: [],
        rangesNegated: false,
        unicodePropertyEscapes: new Map([[node.value, node.negative]]),
      },
      node,
      stack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
