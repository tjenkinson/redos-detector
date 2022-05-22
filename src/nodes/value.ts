import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader-level-0';
import { buildArrayReader } from '../reader';
import { Value } from 'regjsparser';

export function buildValueCharacterReader(node: Value): CharacterReader {
  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups: {
        characterClassEscapes: new Set(),
        dot: false,
        negated: false,
        ranges: [[node.codePoint, node.codePoint]],
        unicodePropertyEscapes: new Set(),
      },
      node,
      stack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
