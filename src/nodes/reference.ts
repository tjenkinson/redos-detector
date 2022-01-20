import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';
import { MyFeatures } from '../parse';
import { Reference } from 'regjsparser';

export function* buildReferenceCharacterReader(
  node: Reference<MyFeatures>
): CharacterReader {
  yield {
    groups: new Map(),
    lookaheadStack: [],
    node,
    quantifierStack: [],
    referenceIndex: node.matchIndex,
    subType: 'reference',
    type: characterReaderTypeCharacterEntry,
  };
}
