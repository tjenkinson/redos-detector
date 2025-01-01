import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader-level-0';
import { buildArrayReader } from '../reader';
import { toUpperCaseCodePoint } from '../code-point';
import { Value } from 'regjsparser';

export function codePointFromValue({
  caseInsensitive,
  value,
}: {
  caseInsensitive: boolean;
  value: Value;
}): number {
  const codePoint = value.codePoint;

  return caseInsensitive ? toUpperCaseCodePoint(codePoint) : codePoint;
}

export function buildValueCharacterReader({
  caseInsensitive,
  node,
}: {
  caseInsensitive: boolean;
  node: Value;
}): CharacterReader {
  const codePoint = codePointFromValue({ caseInsensitive, value: node });
  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups: {
        ranges: [[codePoint, codePoint]],
        rangesNegated: false,
        unicodePropertyEscapes: new Map(),
      },
      node,
      stack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
