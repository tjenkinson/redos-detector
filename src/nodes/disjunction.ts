import { buildArrayReader, chainReaders } from '../reader';
import {
  buildCharacterReader,
  CharacterReader,
  characterReaderTypeSplit,
} from '../character-reader/character-reader-level-0';
import { Disjunction } from 'regjsparser';
import { MyFeatures } from '../parse';

export function buildDisjunctionCharacterReader({
  caseInsensitive,
  dotAll,
  node,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: Disjunction<MyFeatures>;
}): CharacterReader {
  return chainReaders([
    buildArrayReader(
      node.body.slice(0, -1).map((part) => {
        return {
          reader: (): CharacterReader =>
            buildCharacterReader({ caseInsensitive, dotAll, node: part }),
          subType: null,
          type: characterReaderTypeSplit,
        };
      }),
    ),
    buildCharacterReader({
      caseInsensitive,
      dotAll,
      node: node.body[node.body.length - 1],
    }),
  ]);
}
