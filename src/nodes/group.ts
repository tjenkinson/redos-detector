import {
  CharacterReader,
  characterReaderTypeSplit,
} from '../character-reader/character-reader';
import { Group, NonCapturingGroup } from 'regjsparser';
import { buildArrayReader } from '../reader';
import { buildEndReader } from './end';
import { buildSequenceCharacterReader } from './sequence';
import { joinArray } from '../character-reader/join';
import { map } from '../character-reader/map';
import { MyFeatures } from '../parse';
import { QuantifierStack } from './quantifier';

export type GroupEntry = Readonly<{
  quantifierStack: QuantifierStack;
}>;
export type Groups = ReadonlyMap<Group<MyFeatures>, GroupEntry>;
export type GroupsMutable = Map<Group<MyFeatures>, GroupEntry>;
export type LookaheadStack = readonly NonCapturingGroup<MyFeatures>[];

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
                  const newGroups = new Map(value.groups);
                  newGroups.set(node, {
                    quantifierStack: [],
                  });
                  const newLookaheadStack: LookaheadStack = [
                    node,
                    ...value.lookaheadStack,
                  ];
                  return {
                    ...value,
                    groups: newGroups,
                    lookaheadStack: newLookaheadStack,
                  };
                }),
              (): CharacterReader => buildEndReader(node.range[1]),
            ]),
          type: characterReaderTypeSplit,
        },
      ]);
    }
    case 'ignore':
    case 'normal': {
      return map(buildSequenceCharacterReader(node.body), (value) => {
        const newGroups = new Map(value.groups);
        newGroups.set(node, {
          quantifierStack: [],
        });
        return {
          ...value,
          groups: newGroups,
        };
      });
    }
  }
}
