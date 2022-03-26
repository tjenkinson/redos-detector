import {
  buildCharacterReader,
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
} from './character-reader-level-0';
import {
  buildQuantifierIterations,
  QuantifierIterations,
  QuantifierStack,
} from '../nodes/quantifier';
import {
  CapturingGroup,
  CharacterClass,
  CharacterClassEscape,
  Dot,
  Reference,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import { Groups, LookaheadStack } from '../nodes/group';
import { MyFeatures, MyRootNode } from '../parse';
import { Reader, ReaderResult } from '../reader';
import { CharacterGroups } from '../character-groups';
import { dropCommon } from '../arrays';
import { mustGet } from '../map';
import { NodeExtra } from '../node-extra';

export const characterReaderLevel1TypeSplit: unique symbol = Symbol(
  'characterReaderLevel1TypeSplit'
);

export const characterReaderLevel1TypeEntry: unique symbol = Symbol(
  'characterReaderLevel1TypeEntry'
);

export type CharacterReaderLevel1ValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel1;
  type: typeof characterReaderLevel1TypeSplit;
};

export type ZeroWidthEntry = Readonly<
  | {
      groups: Groups;
      type: 'groups';
    }
  | {
      type: 'start';
    }
>;

export type BackReferenceStack = readonly Reference[];
export type CharacterReaderLevel1ValueEntry = Readonly<{
  backreferenceStack: BackReferenceStack;
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
  type: typeof characterReaderLevel1TypeEntry;
}>;

export type CharacterReaderLevel1Value = Readonly<
  CharacterReaderLevel1ValueEntry | CharacterReaderLevel1ValueSplit
>;
export type CharacterReaderLevel1ReturnValue =
  | 'abort'
  | 'endAnchor'
  | 'endUnbounded';
export type CharacterReaderLevel1 = Reader<
  CharacterReaderLevel1Value,
  CharacterReaderLevel1ReturnValue
>;

export type GroupContentsStoreEntryContentsEntry = Readonly<{
  backreferenceStack: readonly Reference[];
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
  groupContentsStore: GroupContentsStore;
  groupsWithInfiniteSize: ReadonlySet<number>;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  quantifierIterationsAtLastGroup: QuantifierIterations;
  threadCharacterReader: CharacterReader;
}>;

/**
 * Returns a `CharacterReaderLevel1` which builds on top of
 * `CharacterReaderLevel0` but replaces references with their
 * contents.
 */
export function buildCharacterReaderLevel1(
  node: MyRootNode,
  nodeExtra: NodeExtra
): CharacterReaderLevel1 {
  const characterReader = buildCharacterReader(node);
  const startThread = function* ({
    threadCharacterReader,
    groupContentsStore,
    preceedingZeroWidthEntries,
    quantifierIterationsAtLastGroup,
    groupsWithInfiniteSize,
  }: ThreadInput): CharacterReaderLevel1 {
    let next: ReaderResult<CharacterReaderValue>;
    while (!(next = threadCharacterReader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderTypeSplit: {
          const _groupContentsStore = groupContentsStore;
          const _quantifierIterationsAtLastGroup =
            quantifierIterationsAtLastGroup;
          const _groupsWithInfiniteSize = groupsWithInfiniteSize;
          const _preceedingZeroWidthEntries = preceedingZeroWidthEntries;
          yield {
            reader: (): CharacterReaderLevel1 =>
              startThread({
                groupContentsStore: _groupContentsStore,
                groupsWithInfiniteSize: _groupsWithInfiniteSize,
                preceedingZeroWidthEntries: _preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup:
                  _quantifierIterationsAtLastGroup,
                threadCharacterReader: value.reader(),
              }),
            type: characterReaderLevel1TypeSplit,
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
          for (const [index, { group }] of groupContentsStore) {
            const offset =
              value.subType === 'null' ||
              value.subType === 'start' ||
              value.subType === 'end'
                ? value.offset
                : value.node.range[0];
            if (group.range[0] >= offset) {
              newGroupContentsStore.delete(index);
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
                        backreferenceStack: [],
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
                            backreferenceStack: [
                              ...entry.backreferenceStack,
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
                  yield {
                    backreferenceStack: [
                      ...contents.backreferenceStack,
                      value.node,
                    ],
                    characterGroups: contents.groups,
                    groups: value.groups,
                    lookaheadStack: value.lookaheadStack,
                    node: contents.node,
                    preceedingZeroWidthEntries,
                    quantifierStack: value.quantifierStack,
                    type: characterReaderLevel1TypeEntry,
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

              yield {
                backreferenceStack: [],
                characterGroups: value.characterGroups,
                groups: value.groups,
                lookaheadStack: value.lookaheadStack,
                node: value.node,
                preceedingZeroWidthEntries,
                quantifierStack: value.quantifierStack,
                type: characterReaderLevel1TypeEntry,
              };

              preceedingZeroWidthEntries = [];
              break;
            }
            case 'end': {
              return 'endAnchor';
            }
            case 'start': {
              preceedingZeroWidthEntries = [
                ...preceedingZeroWidthEntries,
                { type: 'start' },
              ];
              break;
            }
            case 'null': {
              preceedingZeroWidthEntries = [
                ...preceedingZeroWidthEntries,
                { groups: value.groups, type: 'groups' },
              ];
              break;
            }
          }
          break;
        }
      }
    }
    return 'endUnbounded';
  };

  return startThread({
    groupContentsStore: new Map(),
    groupsWithInfiniteSize: new Set(),
    preceedingZeroWidthEntries: [],
    quantifierIterationsAtLastGroup: new Map(),
    threadCharacterReader: characterReader,
  });
}
