import {
  buildCharacterReader,
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
} from './character-reader/character-reader';
import {
  buildQuantifierIterations,
  QuantifierIterations,
  QuantifierStack,
} from './nodes/quantifier';
import {
  CapturingGroup,
  CharacterClass,
  CharacterClassEscape,
  Dot,
  Reference,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import { Groups, LookaheadStack } from './nodes/group';
import { MyFeatures, MyRootNode } from './parse';
import { Reader, ReaderResult } from './reader';
import { CharacterGroups } from './character-groups';
import { dropCommon } from './arrays';
import { mustGet } from './map';
import { NodeExtra } from './node-extra';

export const characterReaderWithReferencesTypeSplit: unique symbol = Symbol(
  'characterReaderWithReferencesTypeSplit'
);

export const characterReaderWithReferencesTypeEntry: unique symbol = Symbol(
  'characterReaderWithReferencesTypeEntry'
);

export type CharacterReaderWithReferencesValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderWithReferences;
  type: typeof characterReaderWithReferencesTypeSplit;
};

export type ZeroWidthEntry = Readonly<{
  groups: Groups;
}>;

export type BackReferenceStack = readonly Reference[];
export type CharacterReaderWithReferencesValueGroups = Readonly<{
  backReferenceStack: BackReferenceStack;
  characterGroups: CharacterGroups;
  groups: Groups;
  lookaheadStack: LookaheadStack;
  node:
    | CharacterClass
    | CharacterClassEscape
    | Dot
    | UnicodePropertyEscape
    | Value;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  quantifierStack: QuantifierStack;
  type: typeof characterReaderWithReferencesTypeEntry;
}>;

export type CharacterReaderWithReferencesValue = Readonly<
  | CharacterReaderWithReferencesValueGroups
  | CharacterReaderWithReferencesValueSplit
>;
export type CharacterReaderWithReferencesReturnValue = 'abort' | 'end';
export type CharacterReaderWithReferences = Reader<
  CharacterReaderWithReferencesValue,
  CharacterReaderWithReferencesReturnValue
>;

export type GroupContentsStoreEntryContentsEntry = Readonly<{
  backReferenceStack: readonly Reference[];
  groups: CharacterGroups;
  node:
    | CharacterClass
    | CharacterClassEscape
    | Dot
    | UnicodePropertyEscape
    | Value;
}>;

export type GroupContentsStoreEntry = Readonly<{
  contents: readonly GroupContentsStoreEntryContentsEntry[];
  group: CapturingGroup<MyFeatures>;
}>;
export type GroupContentsStore = ReadonlyMap<number, GroupContentsStoreEntry>;

function haveHadCompleteIteration(
  before: QuantifierIterations,
  now: QuantifierIterations
): boolean {
  for (const [quantifier, iterationsNow] of now) {
    const iterationsBefore = before.get(quantifier) || 0;
    if (iterationsNow - iterationsBefore > 1) {
      return true;
    }
  }
  return false;
}

type ThreadInput = Readonly<{
  emittedSomething: boolean;
  groupContentsStore: GroupContentsStore;
  groupsWithInfiniteSize: ReadonlySet<number>;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  quantifierIterationsAtLastGroup: QuantifierIterations;
  threadCharacterReader: CharacterReader;
}>;

/**
 * Takes a `CharacterReader`, and returns a new reader which
 * will replace references with their contents.
 */
export function buildCharacterReaderWithReferences(
  node: MyRootNode,
  nodeExtra: NodeExtra
): CharacterReaderWithReferences {
  const characterReader = buildCharacterReader(node);
  const startThread = function* ({
    threadCharacterReader,
    groupContentsStore,
    preceedingZeroWidthEntries,
    quantifierIterationsAtLastGroup,
    groupsWithInfiniteSize,
    emittedSomething,
  }: ThreadInput): CharacterReaderWithReferences {
    let next: ReaderResult<CharacterReaderValue>;
    while (!(next = threadCharacterReader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderTypeSplit: {
          const _groupContentsStore = groupContentsStore;
          const _quantifierIterationsAtLastGroup =
            quantifierIterationsAtLastGroup;
          const _groupsWithInfiniteSize = groupsWithInfiniteSize;
          const _emittedSomething = emittedSomething;
          const _preceedingZeroWidthEntries = preceedingZeroWidthEntries;
          yield {
            reader: (): CharacterReaderWithReferences =>
              startThread({
                emittedSomething: _emittedSomething,
                groupContentsStore: _groupContentsStore,
                groupsWithInfiniteSize: _groupsWithInfiniteSize,
                preceedingZeroWidthEntries: _preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup:
                  _quantifierIterationsAtLastGroup,
                threadCharacterReader: value.reader(),
              }),
            type: characterReaderWithReferencesTypeSplit,
          };
          break;
        }
        case characterReaderTypeCharacterEntry: {
          const getGroupContents = (
            index: number,
            reference: Reference
          ): readonly GroupContentsStoreEntryContentsEntry[] => {
            const group = mustGet(nodeExtra.indexToCapturingGroup, index);
            const groupContents = groupContentsStore.get(index) || {
              contents: [],
              group,
            };

            const { a: groupLookaheadStack } = dropCommon(
              mustGet(nodeExtra.nodeToLookaheadStack, groupContents.group),
              mustGet(nodeExtra.nodeToLookaheadStack, reference)
            );

            if (groupLookaheadStack.length) {
              if (
                groupLookaheadStack.some(
                  ({ behavior }) =>
                    behavior === 'negativeLookahead' ||
                    behavior === 'negativeLookbehind'
                )
              ) {
                return [];
              }

              throw new Error(
                `Unsupported reference (${index} at position ${reference.range[0]}). Pattern needs downgrading. See the \`downgradePattern\` option.`
              );
            }

            if (
              value.groups.has(
                groupContents.group
              ) /* reference is inside group being referenced */
            ) {
              return [];
            }

            if (groupsWithInfiniteSize.has(index)) {
              throw new Error(
                `Unsupported reference to group ${index} as group is not a finite size. Pattern needs downgrading. See the \`downgradePattern\` option.`
              );
            }

            return groupContents.contents;
          };

          const newGroupContentsStore = new Map(groupContentsStore);

          // Clear groups that are now ahead
          // This can happen when a quantifier containing a group restarts
          if (value.subType !== 'end' && value.subType !== 'start') {
            for (const [index, { group }] of groupContentsStore) {
              const offset =
                value.subType === 'null' ? value.offset : value.node.range[0];
              if (group.range[0] >= offset) {
                newGroupContentsStore.delete(index);
              }
            }
          }

          value.groups.forEach(
            ({ quantifierStack: groupQuantifierStack }, group) => {
              if (group.behavior !== 'normal') {
                // it's a non capturing group
                return;
              }

              const index = mustGet(nodeExtra.capturingGroupToIndex, group);
              const contents = newGroupContentsStore.get(index) || {
                contents: [],
                group,
              };

              if (
                value.quantifierStack
                  .map(({ quantifier }) => quantifier)
                  .slice(groupQuantifierStack.length)
                  .some((q) => q.max === undefined)
              ) {
                const newGroupsWithInfiniteSize = new Set(
                  groupsWithInfiniteSize
                );
                newGroupsWithInfiniteSize.add(index);
                groupsWithInfiniteSize = newGroupsWithInfiniteSize;
              }

              switch (value.subType) {
                case 'groups': {
                  newGroupContentsStore.set(index, {
                    ...contents,
                    contents: [
                      ...contents.contents,
                      {
                        backReferenceStack: [],
                        groups: value.characterGroups,
                        node: value.node,
                      },
                    ],
                  });
                  break;
                }
                case 'reference': {
                  newGroupContentsStore.set(index, {
                    ...contents,
                    contents: [
                      ...contents.contents,
                      ...getGroupContents(value.referenceIndex, value.node).map(
                        (entry) => {
                          return {
                            ...entry,
                            backReferenceStack: [
                              ...entry.backReferenceStack,
                              value.node,
                            ],
                          };
                        }
                      ),
                    ],
                  });
                  break;
                }
                case 'end': {
                  return;
                }
                case 'null':
                case 'start': {
                  break;
                }
              }
            }
          );
          groupContentsStore = newGroupContentsStore;

          const quantifierIterations = buildQuantifierIterations(
            value.quantifierStack
          );

          switch (value.subType) {
            case 'reference': {
              const groupContents = getGroupContents(
                value.referenceIndex,
                value.node
              );
              if (groupContents.length) {
                for (const contents of groupContents) {
                  emittedSomething = true;
                  yield {
                    backReferenceStack: [
                      ...contents.backReferenceStack,
                      value.node,
                    ],
                    characterGroups: contents.groups,
                    groups: value.groups,
                    lookaheadStack: value.lookaheadStack,
                    node: contents.node,
                    preceedingZeroWidthEntries,
                    quantifierStack: value.quantifierStack,
                    type: characterReaderWithReferencesTypeEntry,
                  };
                }
              } else if (
                haveHadCompleteIteration(
                  quantifierIterationsAtLastGroup,
                  quantifierIterations
                )
              ) {
                // infinite loop of empty references
                return 'abort';
              }
              break;
            }
            case 'groups': {
              quantifierIterationsAtLastGroup = quantifierIterations;
              emittedSomething = true;

              yield {
                backReferenceStack: [],
                characterGroups: value.characterGroups,
                groups: value.groups,
                lookaheadStack: value.lookaheadStack,
                node: value.node,
                preceedingZeroWidthEntries,
                quantifierStack: value.quantifierStack,
                type: characterReaderWithReferencesTypeEntry,
              };

              preceedingZeroWidthEntries = [];
              break;
            }
            case 'end': {
              return 'end';
            }
            case 'start': {
              if (emittedSomething) {
                return 'abort';
              }
              break;
            }
            case 'null': {
              preceedingZeroWidthEntries = [
                ...preceedingZeroWidthEntries,
                { groups: value.groups },
              ];
              break;
            }
          }
          break;
        }
      }
    }
    return 'end';
  };

  return startThread({
    emittedSomething: false,
    groupContentsStore: new Map(),
    groupsWithInfiniteSize: new Set(),
    preceedingZeroWidthEntries: [],
    quantifierIterationsAtLastGroup: new Map(),
    threadCharacterReader: characterReader,
  });
}
