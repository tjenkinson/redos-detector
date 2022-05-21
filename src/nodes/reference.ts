import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';
import { MyFeatures } from '../parse';
import { Reference } from 'regjsparser';

export function* buildReferenceCharacterReader(
  node: Reference<MyFeatures>
): CharacterReader {
  yield {
    node,
    referenceIndex: node.matchIndex,
    stack: [],
    subType: 'reference',
    type: characterReaderTypeCharacterEntry,
  };
}
