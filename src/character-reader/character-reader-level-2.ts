import {
  buildCharacterReaderLevel1,
  CharacterReaderLevel1,
  CharacterReaderLevel1ReturnValue,
  characterReaderLevel1TypeEntry,
  characterReaderLevel1TypeSplit,
  CharacterReaderLevel1Value,
  ZeroWidthEntry,
} from './character-reader-level-1';
import {
  buildQuantifierIterations,
  getQuantifierStack,
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
import {
  getGroups,
  getLookaheadStack,
  Groups,
  LookaheadStack,
} from '../nodes/group';
import { MyFeatures, MyRootNode } from '../parse';
import { Reader, ReaderResult } from '../reader';
import { CharacterGroups } from '../character-groups';
import { dropCommon } from '../arrays';
import { mustGet } from '../map';
import { NodeExtra } from '../node-extra';

export const characterReaderLevel2TypeSplit: unique symbol = Symbol(
  'characterReaderLevel2TypeSplit'
);

export const characterReaderLevel2TypeEntry: unique symbol = Symbol(
  'characterReaderLevel2TypeEntry'
);

export type CharacterReaderLevel2ValueSplit = Readonly<{
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel2;
  type: typeof characterReaderLevel2TypeSplit;
}>;

export type BackReferenceStack = readonly Reference[];
export type CharacterReaderLevel2ValueEntry = Readonly<{
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
  type: typeof characterReaderLevel2TypeEntry;
}>;

export type CharacterReaderLevel2Value = Readonly<
  CharacterReaderLevel2ValueEntry | CharacterReaderLevel2ValueSplit
>;
export type CharacterReaderLevel2ReturnValue = Readonly<
  | {
      bounded: boolean;
      preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
      type: 'end';
    }
  | { type: 'abort' }
>;
export type CharacterReaderLevel2 = Reader<
  CharacterReaderLevel2Value,
  CharacterReaderLevel2ReturnValue
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
  threadCharacterReader: CharacterReaderLevel1;
}>;

/**
 * Returns a `CharacterReaderLevel2` which builds on top of
 * `CharacterReaderLevel0` but replaces references with their
 * contents.
 */
export function buildCharacterReaderLevel2(
  node: MyRootNode,
  nodeExtra: NodeExtra
): CharacterReaderLevel2 {
  const characterReader = buildCharacterReaderLevel1(node);
  const startThread = function* ({
    threadCharacterReader,
    groupContentsStore,
    preceedingZeroWidthEntries,
    quantifierIterationsAtLastGroup,
    groupsWithInfiniteSize,
  }: ThreadInput): CharacterReaderLevel2 {
    let next: ReaderResult<
      CharacterReaderLevel1Value,
      CharacterReaderLevel1ReturnValue
    >;
    while (!(next = threadCharacterReader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderLevel1TypeSplit: {
          const _groupContentsStore = groupContentsStore;
          const _quantifierIterationsAtLastGroup =
            quantifierIterationsAtLastGroup;
          const _groupsWithInfiniteSize = groupsWithInfiniteSize;
          const _preceedingZeroWidthEntries = preceedingZeroWidthEntries;
          yield {
            reader: (): CharacterReaderLevel2 =>
              startThread({
                groupContentsStore: _groupContentsStore,
                groupsWithInfiniteSize: _groupsWithInfiniteSize,
                preceedingZeroWidthEntries: _preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup:
                  _quantifierIterationsAtLastGroup,
                threadCharacterReader: value.reader(),
              }),
            type: characterReaderLevel2TypeSplit,
          };
          break;
        }
        case characterReaderLevel1TypeEntry: {
          preceedingZeroWidthEntries = [
            ...preceedingZeroWidthEntries,
            ...value.preceedingZeroWidthEntries,
          ];
          const quantifierStack = getQuantifierStack(value.stack);
          const groups = getGroups(value.stack);
          const lookaheadStack = getLookaheadStack(value.stack);
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
              groups.has(
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
            const offsets = [
              ...preceedingZeroWidthEntries.map(({ offset }) => offset),
              value.node.range[0],
            ];
            for (const offset of offsets) {
              if (group.range[0] >= offset) {
                newGroupContentsStore.delete(index);
                break;
              }
            }
          }

          let groupInfiniteSize = false;
          for (const stackEntry of [...value.stack].reverse()) {
            if (
              stackEntry.type === 'quantifier' &&
              stackEntry.quantifier.max === undefined
            ) {
              groupInfiniteSize = true;
              continue;
            } else if (stackEntry.type !== 'group') {
              continue;
            }
            const group = stackEntry.group;

            if (
              group.behavior === 'lookbehind' ||
              group.behavior === 'negativeLookbehind' ||
              group.behavior === 'negativeLookahead' ||
              group.behavior === 'lookahead'
            ) {
              groupInfiniteSize = false;
              continue;
            }

            if (group.behavior !== 'normal') {
              // it's a non capturing group
              continue;
            }

            const index = mustGet(nodeExtra.capturingGroupToIndex, group);

            if (groupInfiniteSize) {
              const newGroupsWithInfiniteSize = new Set(groupsWithInfiniteSize);
              newGroupsWithInfiniteSize.add(index);
              groupsWithInfiniteSize = newGroupsWithInfiniteSize;
            }

            const contents = newGroupContentsStore.get(index) || {
              contents: [],
              group,
            };

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
            }
          }
          groupContentsStore = newGroupContentsStore;

          const quantifierIterations =
            buildQuantifierIterations(quantifierStack);

          switch (value.subType) {
            case 'reference': {
              const groupContents = getGroupContents(
                value.referenceIndex,
                value.node
              );
              if (groupContents.length) {
                for (let i = 0; i < groupContents.length; i++) {
                  const contents = groupContents[i];
                  yield {
                    backreferenceStack: [
                      ...contents.backreferenceStack,
                      value.node,
                    ],
                    characterGroups: contents.groups,
                    groups,
                    lookaheadStack,
                    node: contents.node,
                    preceedingZeroWidthEntries,
                    quantifierStack,
                    type: characterReaderLevel2TypeEntry,
                  };
                  preceedingZeroWidthEntries = [];
                }
              } else if (
                haveHadCompleteIteration(
                  quantifierIterationsAtLastGroup,
                  quantifierIterations
                )
              ) {
                // infinite loop of empty references
                return { type: 'abort' as const };
              }
              break;
            }
            case 'groups': {
              quantifierIterationsAtLastGroup = quantifierIterations;

              yield {
                backreferenceStack: [],
                characterGroups: value.characterGroups,
                groups,
                lookaheadStack,
                node: value.node,
                preceedingZeroWidthEntries,
                quantifierStack,
                type: characterReaderLevel2TypeEntry,
              };
              preceedingZeroWidthEntries = [];
              break;
            }
          }
          break;
        }
      }
    }
    return {
      bounded: next.value.bounded,
      preceedingZeroWidthEntries: [
        ...preceedingZeroWidthEntries,
        ...next.value.preceedingZeroWidthEntries,
      ],
      type: 'end' as const,
    };
  };

  return startThread({
    groupContentsStore: new Map(),
    groupsWithInfiniteSize: new Set(),
    preceedingZeroWidthEntries: [],
    quantifierIterationsAtLastGroup: new Map(),
    threadCharacterReader: characterReader,
  });
}
