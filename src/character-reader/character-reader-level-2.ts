import {
  buildCharacterReaderLevel1,
  CharacterReaderLevel1,
  CharacterReaderLevel1ReturnValue,
  characterReaderLevel1TypeEntry,
  characterReaderLevel1TypeSplit,
  CharacterReaderLevel1Value,
  ZeroWidthEntry,
} from './character-reader-level-1';
import { buildForkableReader, Reader, ReaderResult } from '../reader';
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
  CharacterReaderValueSplitSubType,
  Stack,
  StackEntry,
} from './character-reader-level-0';
import {
  getGroups,
  getLookaheadStack,
  Groups,
  LookaheadStack,
} from '../nodes/group';
import { MyFeatures, MyRootNode } from '../parse';
import { CharacterGroups } from '../character-groups';
import { dropCommon } from '../arrays';
import { mustGet } from '../map';
import { NodeExtra } from '../node-extra';
import { StackReferenceEntry } from '../nodes/reference';

export const characterReaderLevel2TypeSplit: unique symbol = Symbol(
  'characterReaderLevel2TypeSplit',
);

export const characterReaderLevel2TypeEntry: unique symbol = Symbol(
  'characterReaderLevel2TypeEntry',
);

export type CharacterReaderLevel2ValueSplit = Readonly<{
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReaderLevel2;
  subType: CharacterReaderValueSplitSubType;
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

type InternalStackEntry = StackEntry | StackReferenceEntry;
type InternalStack = readonly InternalStackEntry[];

function internalStackToLevel1Stack(internalStack: InternalStack): Stack {
  const stack: StackEntry[] = [];
  for (const entry of internalStack) {
    if (entry.type !== 'reference') stack.push(entry);
  }
  return stack;
}

// `InternalReader` is the same as `CharacteReaderLevel1`, except that the `stack` is `InternalStack`
// which can represent references
const internalReaderTypeSplit: unique symbol = Symbol(
  'internalReaderTypeSplit',
);

const internalReaderTypeEntry: unique symbol = Symbol(
  'internalReaderTypeEntry',
);

type InternalReaderValueSplit = Readonly<{
  // eslint-disable-next-line no-use-before-define
  reader: () => InternalReader;
  subType: CharacterReaderValueSplitSubType;
  type: typeof internalReaderTypeSplit;
}>;

type InternalReaderValueEntryBase = Readonly<{
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  stack: InternalStack;
  type: typeof internalReaderTypeEntry;
}>;

type InternalReaderValueEntryGroups = Readonly<
  InternalReaderValueEntryBase & {
    characterGroups: CharacterGroups;
    node:
      | CharacterClass
      | CharacterClassEscape
      | Dot
      | UnicodePropertyEscape
      | Value;
    subType: 'groups';
  }
>;

type InternalReaderValueEntryReference = Readonly<
  InternalReaderValueEntryBase & {
    node: Reference;
    referenceIndex: number;
    subType: 'reference';
  }
>;

type InternalReaderValueEntry = Readonly<
  InternalReaderValueEntryGroups | InternalReaderValueEntryReference
>;

type InternalReaderValue = Readonly<
  InternalReaderValueEntry | InternalReaderValueSplit
>;

type InternalReaderReturnValue = CharacterReaderLevel1ReturnValue;

type InternalReader = Reader<InternalReaderValue, InternalReaderReturnValue>;

type GroupContentsStoreEntry = Readonly<{
  contents: readonly InternalReaderValueEntryGroups[];
  group: CapturingGroup<MyFeatures>;
}>;
type GroupContentsStore = ReadonlyMap<number, GroupContentsStoreEntry>;

type State = Readonly<{
  characterReader: InternalReader;
  groupContentsStore: GroupContentsStore;
  groupsWithInfiniteSize: ReadonlySet<number>;
  preceedingZeroWidthEntries: readonly ZeroWidthEntry[];
  quantifierIterationsAtLastGroup: QuantifierIterations;
  referenceCharacterReaderWithReference: Readonly<{
    reader: InternalReader;
    reference: Reference;
  }> | null;
}>;

function* characterReaderLevel1ToInternalReader(
  characterReaderLevel1: CharacterReaderLevel1,
): InternalReader {
  let next: ReaderResult<
    CharacterReaderLevel1Value,
    CharacterReaderLevel1ReturnValue
  >;
  while (!(next = characterReaderLevel1.next()).done) {
    const value = next.value;
    switch (value.type) {
      case characterReaderLevel1TypeSplit: {
        yield {
          reader: (): InternalReader =>
            characterReaderLevel1ToInternalReader(value.reader()),
          subType: value.subType,
          type: internalReaderTypeSplit,
        };
        break;
      }
      case characterReaderLevel1TypeEntry: {
        yield {
          ...value,
          type: internalReaderTypeEntry,
        };
        break;
      }
    }
  }
  return next.value;
}

function haveHadCompleteIteration(
  before: QuantifierIterations,
  now: QuantifierIterations,
): boolean {
  for (const [quantifier, iterationsNow] of now) {
    const iterationsBefore = before.get(quantifier) || 0;
    if (iterationsNow - iterationsBefore > 1) {
      return true;
    }
  }
  return false;
}

function* getGroupContentsReader({
  groupContentsStore,
  groups,
  groupsWithInfiniteSize,
  nodeExtra,
  value,
}: {
  groupContentsStore: GroupContentsStore;
  groups: Groups;
  groupsWithInfiniteSize: ReadonlySet<number>;
  nodeExtra: NodeExtra;
  value: InternalReaderValueEntryReference;
}): InternalReader {
  const group = mustGet(nodeExtra.indexToCapturingGroup, value.referenceIndex);
  const groupContents = groupContentsStore.get(value.referenceIndex) || {
    contents: [],
    group,
  };

  const { a: groupLookaheadStack } = dropCommon(
    mustGet(nodeExtra.nodeToLookaheadStack, groupContents.group),
    mustGet(nodeExtra.nodeToLookaheadStack, value.node),
  );

  if (groupLookaheadStack.length) {
    if (
      groupLookaheadStack.some(
        ({ behavior }) =>
          behavior === 'negativeLookahead' || behavior === 'negativeLookbehind',
      )
    ) {
      return { bounded: false, preceedingZeroWidthEntries: [] };
    }

    throw new Error(
      `Unsupported reference (${value.referenceIndex} at position ${value.node.range[0]}). Pattern needs downgrading. See the \`downgradePattern\` option.`,
    );
  }

  if (
    groups.has(
      groupContents.group,
    ) /* reference is inside group being referenced */
  ) {
    return { bounded: false, preceedingZeroWidthEntries: [] };
  }

  if (groupsWithInfiniteSize.has(value.referenceIndex)) {
    throw new Error(
      `Unsupported reference to group ${value.referenceIndex} as group is not a finite size. Pattern needs downgrading. See the \`downgradePattern\` option.`,
    );
  }

  for (const groupEntry of groupContents.contents) {
    yield {
      characterGroups: groupEntry.characterGroups,
      node: groupEntry.node,
      preceedingZeroWidthEntries: groupEntry.preceedingZeroWidthEntries,
      stack: [
        {
          reference: value.node,
          type: `reference`,
        },
        ...groupEntry.stack.filter(({ type }) => type === `reference`),
        ...value.stack,
      ],
      subType: 'groups',
      type: internalReaderTypeEntry,
    };
  }
  return { bounded: false, preceedingZeroWidthEntries: [] };
}

/**
 * Returns a `CharacterReaderLevel2` which builds on top of
 * `CharacterReaderLevel1` but replaces references with their
 * contents and includes the backreference stack.
 */
export function buildCharacterReaderLevel2({
  caseInsensitive,
  dotAll,
  node,
  nodeExtra,
}: {
  caseInsensitive: boolean;
  dotAll: boolean;
  node: MyRootNode;
  nodeExtra: NodeExtra;
}): CharacterReaderLevel2 {
  const startThread = function* (state: State): CharacterReaderLevel2 {
    outer: for (;;) {
      let {
        preceedingZeroWidthEntries,
        groupsWithInfiniteSize,
        groupContentsStore,
        quantifierIterationsAtLastGroup,
      } = state;

      const { characterReader, referenceCharacterReaderWithReference } = state;

      const activeCharacterReader =
        referenceCharacterReaderWithReference?.reader || characterReader;

      const result = activeCharacterReader.next();

      if (result.done) {
        if (referenceCharacterReaderWithReference) {
          /* istanbul ignore next */
          if (result.value.bounded) {
            // for this to happen it means we must be inside a group (from a reference)
            // that contains `$`
            // but we should have stopped reading when the `$` was hit the first time
            // e.g `($)\1` should not reach the `\1`
            throw new Error(
              'Internal error: end of reference reader cannot be bounded',
            );
          }
          state = {
            characterReader,
            groupContentsStore,
            groupsWithInfiniteSize,
            preceedingZeroWidthEntries: [
              ...preceedingZeroWidthEntries,
              ...result.value.preceedingZeroWidthEntries,
            ],
            quantifierIterationsAtLastGroup,
            referenceCharacterReaderWithReference: null,
          };
          continue outer;
        }

        return {
          bounded: result.value.bounded,
          preceedingZeroWidthEntries: [
            ...preceedingZeroWidthEntries,
            ...result.value.preceedingZeroWidthEntries,
          ],
          type: 'end' as const,
        };
      }

      const value = result.value;

      switch (value.type) {
        case internalReaderTypeSplit: {
          /* istanbul ignore next */
          if (referenceCharacterReaderWithReference) {
            throw new Error(
              'Internal error: should not be seeing a split from a reference reader',
            );
          }

          const _groupContentsStore = groupContentsStore;
          const _quantifierIterationsAtLastGroup =
            quantifierIterationsAtLastGroup;
          const _groupsWithInfiniteSize = groupsWithInfiniteSize;
          const _preceedingZeroWidthEntries = preceedingZeroWidthEntries;
          yield {
            reader: (): CharacterReaderLevel2 =>
              startThread({
                characterReader: buildForkableReader(value.reader()),
                groupContentsStore: _groupContentsStore,
                groupsWithInfiniteSize: _groupsWithInfiniteSize,
                preceedingZeroWidthEntries: _preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup:
                  _quantifierIterationsAtLastGroup,
                referenceCharacterReaderWithReference:
                  referenceCharacterReaderWithReference,
              }),
            subType: value.subType,
            type: characterReaderLevel2TypeSplit,
          };
          break;
        }
        case internalReaderTypeEntry: {
          preceedingZeroWidthEntries = [
            ...preceedingZeroWidthEntries,
            ...value.preceedingZeroWidthEntries,
          ];

          const quantifierStack = getQuantifierStack(
            internalStackToLevel1Stack(value.stack),
          );
          const quantifierIterations =
            buildQuantifierIterations(quantifierStack);
          const lookaheadStack = getLookaheadStack(
            internalStackToLevel1Stack(value.stack),
          );

          const groups = getGroups(internalStackToLevel1Stack(value.stack));

          switch (value.subType) {
            case 'reference': {
              /* istanbul ignore next */
              if (referenceCharacterReaderWithReference) {
                throw new Error(
                  'Internal error: should not be seeing a reference from a reference reader',
                );
              }

              if (
                haveHadCompleteIteration(
                  quantifierIterationsAtLastGroup,
                  quantifierIterations,
                )
              ) {
                // bail as we're in a loop of empty references
                // e.g. `(a?)b\1+a?$`
                return {
                  type: 'abort' as const,
                };
              }

              const groupContentsReader = buildForkableReader(
                getGroupContentsReader({
                  groupContentsStore,
                  groups,
                  groupsWithInfiniteSize,
                  nodeExtra,
                  value,
                }),
              );

              state = {
                characterReader,
                groupContentsStore,
                groupsWithInfiniteSize,
                preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup,
                referenceCharacterReaderWithReference: {
                  reader: groupContentsReader,
                  reference: value.node,
                },
              };
              break;
            }
            case 'groups': {
              const newGroupContentsStore = new Map(groupContentsStore);

              if (!referenceCharacterReaderWithReference) {
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
                  const newGroupsWithInfiniteSize = new Set(
                    groupsWithInfiniteSize,
                  );
                  newGroupsWithInfiniteSize.add(index);
                  groupsWithInfiniteSize = newGroupsWithInfiniteSize;
                }

                const contents = newGroupContentsStore.get(index) || {
                  contents: [],
                  group,
                };

                newGroupContentsStore.set(index, {
                  ...contents,
                  contents: [
                    ...contents.contents,
                    {
                      ...value,
                      preceedingZeroWidthEntries:
                        preceedingZeroWidthEntries.filter(
                          ({ offset }) =>
                            // only include entries that are within the group
                            // e.g `^` in (^a) but not `^(a)`
                            offset >= group.range[0] &&
                            offset <= group.range[1],
                        ),
                    },
                  ],
                });
              }
              groupContentsStore = newGroupContentsStore;
              quantifierIterationsAtLastGroup = quantifierIterations;

              yield {
                backreferenceStack: value.stack
                  .flatMap((stackEntry) =>
                    stackEntry.type === 'reference'
                      ? [stackEntry.reference]
                      : [],
                  )
                  .reverse(),
                characterGroups: value.characterGroups,
                groups,
                lookaheadStack,
                node: value.node,
                preceedingZeroWidthEntries,
                quantifierStack,
                type: characterReaderLevel2TypeEntry,
              };
              preceedingZeroWidthEntries = [];

              state = {
                characterReader,
                groupContentsStore,
                groupsWithInfiniteSize,
                preceedingZeroWidthEntries,
                quantifierIterationsAtLastGroup,
                referenceCharacterReaderWithReference,
              };
              break;
            }
          }
        }
      }
    }
  };

  return startThread({
    characterReader: buildForkableReader(
      characterReaderLevel1ToInternalReader(
        buildCharacterReaderLevel1({ caseInsensitive, dotAll, node }),
      ),
    ),
    groupContentsStore: new Map(),
    groupsWithInfiniteSize: new Set(),
    preceedingZeroWidthEntries: [],
    quantifierIterationsAtLastGroup: new Map(),
    referenceCharacterReaderWithReference: null,
  });
}
