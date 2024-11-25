import {
  CharacterReader,
  characterReaderTypeSplit,
} from '../character-reader/character-reader-level-0';
import { Group, NonCapturingGroup } from 'regjsparser';
import { buildArrayReader } from '../reader';
import { buildEndReader } from './end';
import { buildSequenceCharacterReader } from './sequence';
import { CharacterReaderLevel2Stack } from '../character-reader/character-reader-level-2';
import { joinArray } from '../character-reader/join';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';

export type StackGroupEntry = Readonly<{
  group: Group<MyFeatures>;
  type: 'group';
}>;
export type Groups = ReadonlySet<Group<MyFeatures>>;
export type LookaheadStack = readonly NonCapturingGroup<MyFeatures>[];

export function getGroups(stack: CharacterReaderLevel2Stack): Groups {
  return new Set(
    stack.flatMap((entry) => (entry.type === 'group' ? [entry.group] : [])),
  );
}

export function getLookaheadStack(
  stack: CharacterReaderLevel2Stack,
): LookaheadStack {
  const lookaheadStack: NonCapturingGroup<MyFeatures>[] = [];
  for (const entry of stack) {
    if (entry.type === 'group') {
      const { group } = entry;
      const { behavior } = group;
      if (
        behavior === 'lookbehind' ||
        behavior === 'negativeLookbehind' ||
        behavior === 'negativeLookahead' ||
        behavior === 'lookahead'
      ) {
        lookaheadStack.push(group);
      }
    }
  }
  return lookaheadStack;
}

export function buildGroupCharacterReader({
  caseInsensitive,
  dotAll,
  node,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: Group<MyFeatures>;
}): CharacterReader {
  switch (node.behavior) {
    case 'lookbehind':
    case 'negativeLookbehind':
    case 'lookahead':
    case 'negativeLookahead': {
      return buildArrayReader([
        {
          reader: (): CharacterReader =>
            joinArray([
              (): CharacterReader =>
                map(
                  buildSequenceCharacterReader({
                    caseInsensitive,
                    dotAll,
                    nodes: node.body,
                  }),
                  (value) => {
                    return {
                      ...value,
                      stack: [{ group: node, type: 'group' }, ...value.stack],
                    };
                  },
                ),
              (): CharacterReader => buildEndReader(node.range[1]),
            ]),
          subType: node.behavior,
          type: characterReaderTypeSplit,
        },
      ]);
    }
    case 'ignore':
    case 'normal': {
      return map(
        buildSequenceCharacterReader({
          caseInsensitive,
          dotAll,
          nodes: node.body,
        }),
        (value) => {
          return {
            ...value,
            stack: [{ group: node, type: 'group' }, ...value.stack],
          };
        },
      );
    }
  }
}
