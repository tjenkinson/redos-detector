import {
  CharacterReader,
  characterReaderTypeSplit,
  Stack,
} from '../character-reader/character-reader-level-0';
import { Group, NonCapturingGroup } from 'regjsparser';
import { QuantifierStack, StackQuantifierEntry } from './quantifier';
import { buildArrayReader } from '../reader';
import { buildEndReader } from './end';
import { buildSequenceCharacterReader } from './sequence';
import { joinArray } from '../character-reader/join';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';

export type StackGroupEntry = Readonly<{
  group: Group<MyFeatures>;
  type: 'group';
}>;
export type GroupEntry = Readonly<{
  quantifierStack: QuantifierStack;
}>;
export type Groups = ReadonlyMap<Group<MyFeatures>, GroupEntry>;
export type GroupsMutable = Map<Group<MyFeatures>, GroupEntry>;
export type LookaheadStack = readonly NonCapturingGroup<MyFeatures>[];

export function getGroups(stack: Stack): Groups {
  const quantifierStack: StackQuantifierEntry[] = [];
  const groups: GroupsMutable = new Map();
  for (const entry of stack) {
    if (entry.type === 'quantifier') {
      quantifierStack.push(entry);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (entry.type === 'group') {
      groups.set(entry.group, { quantifierStack: [...quantifierStack] });
    }
  }
  return groups;
}

export function getLookaheadStack(stack: Stack): LookaheadStack {
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

export function buildGroupCharacterReader(
  node: Group<MyFeatures>
): CharacterReader {
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
                map(buildSequenceCharacterReader(node.body), (value) => {
                  return {
                    ...value,
                    stack: [{ group: node, type: 'group' }, ...value.stack],
                  };
                }),
              (): CharacterReader => buildEndReader(node.range[1]),
            ]),
          subType: node.behavior === 'lookahead' ? 'lookahead' : null,
          type: characterReaderTypeSplit,
        },
      ]);
    }
    case 'ignore':
    case 'normal': {
      return map(buildSequenceCharacterReader(node.body), (value) => {
        return {
          ...value,
          stack: [{ group: node, type: 'group' }, ...value.stack],
        };
      });
    }
  }
}
