import {
  AstNode,
  CharacterClass,
  CharacterClassEscape,
  Dot,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import {
  BackReferenceStack,
  CharacterReaderWithReferences,
  CharacterReaderWithReferencesReturnValue,
  characterReaderWithReferencesTypeSplit,
  CharacterReaderWithReferencesValue,
} from './character-reader-with-references';
import {
  buildForkableReader,
  ForkableReader,
  Reader,
  ReaderResult,
} from './reader';
import {
  buildQuantifiersInInfinitePortion,
  buildQuantifierTrail,
  QuantifierStack,
} from './nodes/quantifier';
import {
  CharacterGroups,
  intersectCharacterGroups,
  isEmptyCharacterGroups,
} from './character-groups';
import { atomicGroupsToSynchronisationCheckerKeys } from './atomic-groups-to-synchronisation-checker-keys';
import { InfiniteLoopTracker } from './infinite-loop-tracker';
import { last } from './arrays';
import { MyFeatures } from './parse';
import { setsOverlap } from './set';
import { SidesEqualChecker } from './sides-equal-checker';
import { synchronisationCheck } from './synchronisation-checker';

export type CheckerInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  leftStreamReader: CharacterReaderWithReferences;
  maxSteps: number;
  rightStreamReader: CharacterReaderWithReferences;
  sidesEqualChecker: SidesEqualChecker;
  timeout: number;
}>;

export type CharacterGroupsOrReference = Readonly<
  | {
      groups: CharacterGroups;
      type: 'groups';
    }
  | {
      index: number;
      type: 'reference';
    }
>;

export type TrailEntrySide = Readonly<{
  backreferenceStack: BackReferenceStack;
  node:
    | CharacterClass
    | CharacterClassEscape
    | Dot
    | UnicodePropertyEscape
    | Value;
  quantifierStack: QuantifierStack;
}>;

export type TrailEntry = Readonly<{
  intersection: CharacterGroups;
  left: TrailEntrySide;
  right: TrailEntrySide;
}>;

export type Trail = readonly TrailEntry[];

export const checkerReaderTypeTrail: unique symbol = Symbol(
  'checkerReaderTypeTrail'
);
export const checkerReaderTypeInfiniteResults: unique symbol = Symbol(
  'checkerReaderTypeInfiniteResults'
);

export type CheckerReaderValueTrail = Readonly<{
  trail: Trail;
  type: typeof checkerReaderTypeTrail;
}>;
export type CheckerReaderValueInfiniteResults = Readonly<{
  type: typeof checkerReaderTypeInfiniteResults;
}>;
export type CheckerReaderValue =
  | CheckerReaderValueInfiniteResults
  | CheckerReaderValueTrail;

// eslint-disable-next-line no-use-before-define
export type CheckerReader = Reader<CheckerReaderValue, CheckerReaderReturn>;
export type CheckerReaderReturn = Readonly<{
  error: 'hitMaxSteps' | 'stackOverflow' | 'timedOut' | null;
}>;

const stackOverflowLimit = 1500;

type NodeWithQuantifierTrail = Readonly<{
  node: AstNode<MyFeatures>;
  quantifierTrail: string;
}>;

type StartThreadInput = Readonly<{
  atomicGroupsInSync: ReadonlyMap<string, boolean>;
  infiniteLoopTracker: InfiniteLoopTracker<NodeWithQuantifierTrail>;
  leftInitial: ReaderResult<
    CharacterReaderWithReferencesValue,
    CharacterReaderWithReferencesReturnValue
  > | null;
  leftStreamReader: ForkableReader<
    CharacterReaderWithReferencesValue,
    CharacterReaderWithReferencesReturnValue
  >;
  level: number;
  rightStreamReader: ForkableReader<
    CharacterReaderWithReferencesValue,
    CharacterReaderWithReferencesReturnValue
  >;
  trail: Trail;
}>;

const isNodeWithQuantifierTrailEqual = (
  left: NodeWithQuantifierTrail,
  right: NodeWithQuantifierTrail
): boolean =>
  left.node === right.node && left.quantifierTrail === right.quantifierTrail;

/**
 * Takes a left and right `CharacterReaderWithReferences` and runs them against each other.
 *
 * If the left and right reader reach the end of the pattern at the same time, but have taken
 * different routes, then this means there are at least 2 different ways of matching the same
 * input.
 */
export function* buildCheckerReader(input: CheckerInput): CheckerReader {
  const { sidesEqualChecker } = input;
  const trails = new Set<Trail>();
  let stepCount = 0;
  const latestEndTime = Date.now() + input.timeout;
  let timedOut = false;
  let stackOverflow = false;
  let infiniteResults = false;

  const startThread = function* ({
    leftStreamReader,
    leftInitial,
    rightStreamReader,
    trail,
    infiniteLoopTracker,
    // this is used to track atomic groups
    // if an atomic group starts at the same point on right/left, but ends at different points,
    // then we can discard that trail as it would be invalid, as it means the atomic group
    // was not atomic
    atomicGroupsInSync,
    level,
  }: StartThreadInput): Reader<CheckerReaderValue> {
    const dispose = (): void => {
      leftStreamReader.dispose();
      rightStreamReader.dispose();
    };

    if (level >= stackOverflowLimit) {
      stackOverflow = true;
    }

    for (;;) {
      if (!timedOut) timedOut = Date.now() > latestEndTime;
      if (timedOut || stackOverflow) {
        dispose();
        return;
      }
      const nextLeft: ReaderResult<
        CharacterReaderWithReferencesValue,
        CharacterReaderWithReferencesReturnValue
      > = leftInitial ?? leftStreamReader.next();
      leftInitial = null;

      if (
        !nextLeft.done &&
        nextLeft.value.type === characterReaderWithReferencesTypeSplit
      ) {
        const reader = startThread({
          atomicGroupsInSync,
          infiniteLoopTracker: infiniteLoopTracker.clone(),
          leftInitial: null,
          leftStreamReader: buildForkableReader(nextLeft.value.reader()),
          level: level + 1,
          rightStreamReader: rightStreamReader.fork(),
          trail,
        });

        let next: ReaderResult<CheckerReaderValue>;
        while (!(next = reader.next()).done) {
          yield next.value;
        }
        continue;
      }

      const nextRight: ReaderResult<
        CharacterReaderWithReferencesValue,
        CharacterReaderWithReferencesReturnValue
      > = rightStreamReader.next();
      if (
        !nextRight.done &&
        nextRight.value.type === characterReaderWithReferencesTypeSplit
      ) {
        const reader = startThread({
          atomicGroupsInSync,
          infiniteLoopTracker: infiniteLoopTracker.clone(),
          leftInitial: nextLeft,
          leftStreamReader: leftStreamReader.fork(),
          level: level + 1,
          rightStreamReader: buildForkableReader(nextRight.value.reader()),
          trail,
        });

        let next: ReaderResult<CheckerReaderValue>;
        while (!(next = reader.next()).done) {
          yield next.value;
        }

        leftInitial = nextLeft;
        continue;
      }

      if (++stepCount > input.maxSteps) {
        dispose();
        return;
      }

      if (
        (nextLeft.done && nextLeft.value === 'abort') ||
        (nextRight.done && nextRight.value === 'abort')
      ) {
        dispose();
        return;
      }

      if (nextLeft.done && nextRight.done) {
        if (!trails.has(trail)) {
          const leftAndRightIdentical = trail.every((entry) =>
            sidesEqualChecker.areSidesEqual(entry.left, entry.right)
          );

          if (!leftAndRightIdentical) {
            const alreadyExists = [...trails].some((existingTrail) => {
              if (existingTrail.length !== trail.length) return false;

              return (
                existingTrail.every(
                  (existingEntry, i) =>
                    sidesEqualChecker.areSidesEqual(
                      existingEntry.left,
                      trail[i].right
                    ) &&
                    sidesEqualChecker.areSidesEqual(
                      existingEntry.right,
                      trail[i].left
                    )
                ) ||
                existingTrail.every(
                  (existingEntry, i) =>
                    sidesEqualChecker.areSidesEqual(
                      existingEntry.left,
                      trail[i].left
                    ) &&
                    sidesEqualChecker.areSidesEqual(
                      existingEntry.right,
                      trail[i].right
                    )
                )
              );
            });

            if (!alreadyExists) {
              trails.add(trail);
              yield { trail, type: checkerReaderTypeTrail };
            }
          }
        }
        return;
      }

      if (nextLeft.done || nextRight.done) {
        dispose();
        return;
      }

      const leftValue = nextLeft.value;
      const rightValue = nextRight.value;
      /* istanbul ignore next */
      if (
        leftValue.type === characterReaderWithReferencesTypeSplit ||
        rightValue.type === characterReaderWithReferencesTypeSplit
      ) {
        throw new Error('Internal error: impossible leftValue/rightValue type');
      }

      const leftLookahead = last(leftValue.lookaheadStack);
      const rightLookahead = last(rightValue.lookaheadStack);
      if (leftLookahead !== rightLookahead) {
        // something before a lookahead can't give something up to be consumed in the lookahead
        // therefore we only want to compare instances that start a lookahead in sync
        // I.e. `a+(?=a+)` is fine but `a+(?=a+a+)` is not
        dispose();
        return;
      }

      const leftQuantifiersInInfiniteProportion =
        buildQuantifiersInInfinitePortion(leftValue.quantifierStack);
      const rightQuantifiersInInfiniteProportion =
        buildQuantifiersInInfinitePortion(rightValue.quantifierStack);

      if (
        setsOverlap(
          leftQuantifiersInInfiniteProportion,
          rightQuantifiersInInfiniteProportion
        )
      ) {
        const leftAndRightIdentical = trail.every((entry) =>
          sidesEqualChecker.areSidesEqual(entry.left, entry.right)
        );
        if (leftAndRightIdentical) {
          // left and right have been identical to each other, and we are now entering an infinite
          // portion, so bail
          dispose();
          return;
        }
      }

      if (
        leftQuantifiersInInfiniteProportion.size &&
        rightQuantifiersInInfiniteProportion.size
      ) {
        infiniteLoopTracker.append(
          {
            node: leftValue.node,
            quantifierTrail: buildQuantifierTrail(
              leftValue.quantifierStack,
              true
            ),
          },
          {
            node: rightValue.node,
            quantifierTrail: buildQuantifierTrail(
              rightValue.quantifierStack,
              true
            ),
          }
        );
      } else {
        infiniteLoopTracker = new InfiniteLoopTracker(
          isNodeWithQuantifierTrailEqual
        );
      }

      if (infiniteLoopTracker.isLooping()) {
        if (!infiniteResults) {
          infiniteResults = true;
          yield { type: checkerReaderTypeInfiniteResults };
        }
        dispose();
        return;
      }

      const intersection = intersectCharacterGroups(
        leftValue.characterGroups,
        rightValue.characterGroups
      );
      if (isEmptyCharacterGroups(intersection)) {
        dispose();
        return;
      }

      const syncResult = synchronisationCheck(
        atomicGroupsInSync,
        atomicGroupsToSynchronisationCheckerKeys({
          atomicGroupOffsets: input.atomicGroupOffsets,
          leftGroupsNow: leftValue.groups,
          leftPreceedingGroups: leftValue.preceedingZeroWidthEntries.map(
            ({ groups }) => groups
          ),
          rightGroupsNow: rightValue.groups,
          rightPreceedingGroups: rightValue.preceedingZeroWidthEntries.map(
            ({ groups }) => groups
          ),
        })
      );

      if (syncResult.type === 'goneOutOfSync') {
        dispose();
        return;
      }
      atomicGroupsInSync = syncResult.keysInSync;

      trail = [
        ...trail,
        {
          intersection,
          left: {
            backreferenceStack: leftValue.backreferenceStack,
            node: leftValue.node,
            quantifierStack: leftValue.quantifierStack,
          },
          right: {
            backreferenceStack: rightValue.backreferenceStack,
            node: rightValue.node,
            quantifierStack: rightValue.quantifierStack,
          },
        },
      ];
    }
  };

  const reader = startThread({
    atomicGroupsInSync: new Map(),
    infiniteLoopTracker: new InfiniteLoopTracker(
      isNodeWithQuantifierTrailEqual
    ),
    leftInitial: null,
    leftStreamReader: buildForkableReader(input.leftStreamReader),
    level: 0,
    rightStreamReader: buildForkableReader(input.rightStreamReader),
    trail: [],
  });

  let next: ReaderResult<CheckerReaderValue>;
  while (!(next = reader.next()).done) {
    yield next.value;
  }

  return {
    error:
      stepCount > input.maxSteps
        ? ('hitMaxSteps' as const)
        : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        timedOut
        ? ('timedOut' as const)
        : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        stackOverflow
        ? ('stackOverflow' as const)
        : null,
  };
}
