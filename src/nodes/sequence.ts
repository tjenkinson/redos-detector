import {
  buildCharacterReader,
  CharacterReader,
} from '../character-reader/character-reader-level-0';
import { joinArray } from '../character-reader/join';
import { MyRootNode } from '../parse';

export function buildSequenceCharacterReader({
  caseInsensitive,
  dotAll,
  nodes,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  nodes: readonly MyRootNode[];
}): CharacterReader {
  return joinArray(
    nodes.map((node) => {
      return (): CharacterReader =>
        buildCharacterReader({ caseInsensitive, dotAll, node });
    }),
  );
}
