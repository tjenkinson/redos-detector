import {
  AstNode,
  CharacterClass,
  CharacterClassEscape,
  Dot,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import {
  buildForkableReader,
  ForkableReader,
  Reader,
  ReaderResult,
} from './reader';
import {
  CharacterGroups,
  intersectCharacterGroups,
  isEmptyCharacterGroups,
} from './character-groups';
import {
  CharacterReaderLevel2,
  CharacterReaderLevel2ReturnValue,
  CharacterReaderLevel2Stack,
  characterReaderLevel2TypeEntry,
  characterReaderLevel2TypeSplit,
  CharacterReaderLevel2Value,
} from './character-reader/character-reader-level-2';
import { Entry, InfiniteLoopTracker } from './infinite-loop-tracker';
import {
  isUnboundedReader,
  isUnboundedReaderTypeStep,
  IsUnboundedReaderValue,
} from './is-unbounded-reader';
import { areSetsEqual } from './sets';
import { buildQuantifiersInInfinitePortion } from './nodes/quantifier';
import { fork } from 'forkable-iterator';
import { last } from './arrays';
import { MyFeatures } from './parse';
import { once } from './once';
import { SidesEqualChecker } from './sides-equal-checker';

export type CheckerInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  leftStreamReader: CharacterReaderLevel2;
  maxSteps: number;
  multiLine: boolean;
  rightStreamReader: CharacterReaderLevel2;
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
  characterGroups: CharacterGroups;
  contextTrail: string;
  node:
    | CharacterClass
    | CharacterClassEscape
    | Dot
    | UnicodePropertyEscape
    | Value;
  stack: CharacterReaderLevel2Stack;
}>;

export type TrailEntry = Readonly<{
  intersection: CharacterGroups;
  left: TrailEntrySide;
  right: TrailEntrySide;
}>;

export type Trail = readonly TrailEntry[];

export const checkerReaderTypeTrail: unique symbol = Symbol(
  'checkerReaderTypeTrail',
);
export const checkerReaderTypeInfiniteLoop: unique symbol = Symbol(
  'checkerReaderTypeInfiniteLoop',
);

export type CheckerReaderValueTrail = Readonly<{
  trail: Trail;
  type: typeof checkerReaderTypeTrail;
}>;
export type CheckerReaderValue = CheckerReaderValueTrail;

// eslint-disable-next-line no-use-before-define
export type CheckerReader = Reader<CheckerReaderValue, CheckerReaderReturn>;
export type CheckerReaderReturn = Readonly<
  | { error: null; infinite: boolean }
  | {
      error: 'hitMaxSteps' | 'timedOut';
    }
>;

type InfiniteLoopTrackerEntry = Readonly<{
  contextTrail: string;
  node: AstNode<MyFeatures>;
}>;

type ReaderWithGetter = Readonly<{
  get: () => ReaderResult<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >;
  reader: ForkableReader<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >;
}>;

type StackFrame = Readonly<{
  infiniteLoopTracker: InfiniteLoopTracker<InfiniteLoopTrackerEntry>;
  streamReadersWithGetters: ReaderWithGetter[];
  trail: Trail;
}>;

const areInfiniteLoopTrackerEntriesEqual = (
  left: InfiniteLoopTrackerEntry,
  right: InfiniteLoopTrackerEntry,
): boolean => {
  return left.node === right.node && left.contextTrail === right.contextTrail;
};

function buildContextTrail(
  stack: CharacterReaderLevel2Stack,
  asteriskInfinite: boolean,
): string {
  return stack
    .map((entry) => {
      if (entry.type === 'quantifier') {
        return `q:${entry.quantifier.range[0]}:${
          asteriskInfinite &&
          entry.quantifier.max === undefined &&
          entry.iteration >= entry.quantifier.min
            ? '*'
            : `${entry.iteration}`
        }`;
      }
      if (entry.type === 'reference') {
        return `r:${entry.reference.range[0]}`;
      }
    })
    .filter(Boolean)
    .join(',');
}

/**
 * Takes a left and right `CharacterReaderLevel2` and runs them against each other.
 *
 * Emits a trail when left and right differ, as it means there are 2 different ways of matching the same
 * trail up to that point.
 */
export function* buildCheckerReader(input: CheckerInput): CheckerReader {
  const sidesEqualChecker = new SidesEqualChecker();
  const trails = new Set<Trail>();
  const trailEntriesAtStartOfLoop = new Set<TrailEntry>();
  const infiniteLoopTrackerEntryToTrailEntry = new Map<
    Entry<InfiniteLoopTrackerEntry>,
    TrailEntry
  >();
  let stepCount = 0;
  const latestEndTime = Date.now() + input.timeout;
  let timedOut = false;

  const initialLeftStreamReader = buildForkableReader(input.leftStreamReader);
  const initialRightStreamReader = buildForkableReader(input.rightStreamReader);

  const stack: StackFrame[] = [
    {
      infiniteLoopTracker: new InfiniteLoopTracker(
        areInfiniteLoopTrackerEntriesEqual,
      ),
      streamReadersWithGetters: [
        {
          get: once(() => initialLeftStreamReader.next()),
          reader: initialLeftStreamReader,
        },
        {
          get: once(() => initialRightStreamReader.next()),
          reader: initialRightStreamReader,
        },
      ],
      trail: [],
    },
  ];

  outer: for (;;) {
    timedOut = Date.now() > latestEndTime;
    if (timedOut || stepCount > input.maxSteps) {
      break;
    }

    const entry = stack.pop();
    if (!entry) break;

    const { streamReadersWithGetters } = entry;
    const { infiniteLoopTracker } = entry;
    let { trail } = entry;

    const nextValues: ReaderResult<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >[] = [];

    for (let i = 0; i < streamReadersWithGetters.length; i++) {
      stepCount += 0.5;
      const result = streamReadersWithGetters[i].get();
      if (
        !result.done &&
        result.value.type === characterReaderLevel2TypeSplit
      ) {
        const value = result.value;

        stack.push({
          infiniteLoopTracker,
          streamReadersWithGetters: streamReadersWithGetters.map(
            ({ reader, get }, j) => ({
              get: j === i ? once(() => reader.next()) : get,
              reader,
            }),
          ),
          trail,
        });

        const newStreamReadersWithGetters = streamReadersWithGetters.map(
          ({ reader, get }, j) => {
            const newReader =
              j === i ? buildForkableReader(value.reader()) : fork(reader);
            return {
              get: j < i ? get : once(() => newReader.next()),
              reader: newReader,
            };
          },
        );

        stack.push({
          infiniteLoopTracker: infiniteLoopTracker.clone(),
          streamReadersWithGetters: newStreamReadersWithGetters,
          trail,
        });
        continue outer;
      } else {
        nextValues.push(result);
      }
    }

    const [leftNextValue, rightNextValue] = nextValues;

    if (
      stepCount > input.maxSteps ||
      leftNextValue.done ||
      rightNextValue.done
    ) {
      continue;
    }

    /* istanbul ignore next */
    if (
      leftNextValue.value.type !== characterReaderLevel2TypeEntry ||
      rightNextValue.value.type !== characterReaderLevel2TypeEntry
    ) {
      throw new Error('Internal error: impossible leftValue/rightValue type');
    }

    const leftValue = leftNextValue.value;
    const rightValue = rightNextValue.value;

    const leftPassedStartAnchor = leftValue.precedingZeroWidthEntries.some(
      ({ type }) => type === 'start',
    );
    const rightPassedStartAnchor = rightValue.precedingZeroWidthEntries.some(
      ({ type }) => type === 'start',
    );
    const somethingPassedStartAnchor =
      leftPassedStartAnchor || rightPassedStartAnchor;

    if (trail.length > 0 && somethingPassedStartAnchor) {
      continue;
    }

    const leftLookahead = last(leftValue.lookaheadStack);
    const rightLookahead = last(rightValue.lookaheadStack);

    if (leftLookahead !== rightLookahead) {
      // something before a lookahead can't give something up to be consumed in the lookahead
      // therefore we only want to compare instances that start a lookahead in sync
      // I.e. `a+(?=a+)` is fine but `a+(?=a+a+)` is not
      continue;
    }

    const intersection = intersectCharacterGroups(
      leftValue.characterGroups,
      rightValue.characterGroups,
    );

    if (isEmptyCharacterGroups(intersection)) {
      continue;
    }

    const newEntry: TrailEntry = {
      intersection,
      left: {
        characterGroups: leftValue.characterGroups,
        contextTrail: buildContextTrail(leftValue.stack, false),
        node: leftValue.node,
        stack: leftValue.stack,
      },
      right: {
        characterGroups: rightValue.characterGroups,
        contextTrail: buildContextTrail(rightValue.stack, false),
        node: rightValue.node,
        stack: rightValue.stack,
      },
    };

    trail = [...trail, newEntry];

    const leftQuantifiersInInfiniteProportion =
      buildQuantifiersInInfinitePortion(leftValue.stack);

    if (leftQuantifiersInInfiniteProportion.size > 0) {
      const leftAndRightIdentical = trail.every(({ left, right }) =>
        sidesEqualChecker.areSidesEqual(left, right),
      );
      if (leftAndRightIdentical) {
        // left and right have been identical to each other, and we are now entering an infinite
        // portion, so bail
        continue;
      }
    }

    const infiniteLoopTrackerEntry: Entry<InfiniteLoopTrackerEntry> = {
      left: {
        contextTrail: buildContextTrail(leftValue.stack, true),
        node: leftValue.node,
      },
      right: {
        contextTrail: buildContextTrail(rightValue.stack, true),
        node: rightValue.node,
      },
    };
    infiniteLoopTrackerEntryToTrailEntry.set(
      infiniteLoopTrackerEntry,
      newEntry,
    );
    infiniteLoopTracker.append(infiniteLoopTrackerEntry);

    const repeatingEntries = infiniteLoopTracker.getRepeatingEntries();
    if (repeatingEntries) {
      const entryAtStartOfLoop = infiniteLoopTrackerEntryToTrailEntry.get(
        repeatingEntries[0],
      );
      /* istanbul ignore next */
      if (!entryAtStartOfLoop) {
        throw new Error('Internal error: missing entry at start of loop');
      }
      trailEntriesAtStartOfLoop.add(entryAtStartOfLoop);
      continue;
    }

    const leftAtomicGroups = new Set(
      [...leftValue.groups.keys()].filter((group) =>
        input.atomicGroupOffsets.has(group.range[0]),
      ),
    );
    const rightAtomicGroups = new Set(
      [...rightValue.groups.keys()].filter((group) =>
        input.atomicGroupOffsets.has(group.range[0]),
      ),
    );
    if (!areSetsEqual(leftAtomicGroups, rightAtomicGroups)) {
      // if we are not entering/leaving an atomic group in sync
      // then bail, as atomic groups can't give something up to be
      // consumed somewhere else
      continue;
    }

    const sidesEqual = sidesEqualChecker.areSidesEqual(
      newEntry.left,
      newEntry.right,
    );

    if (!sidesEqual) {
      let leftAndRightUnbounded: boolean;
      let leftUnbounded: boolean;
      {
        const leftUnboundedReader = isUnboundedReader({
          multiLine: input.multiLine,
          reader: fork(streamReadersWithGetters[0].reader),
        });
        let leftUnboundedCheckReaderNext: ReaderResult<
          IsUnboundedReaderValue,
          boolean
        >;
        while (
          !(leftUnboundedCheckReaderNext = leftUnboundedReader.next()).done
        ) {
          switch (leftUnboundedCheckReaderNext.value.type) {
            case isUnboundedReaderTypeStep: {
              stepCount += 0.5;
              if (stepCount > input.maxSteps) {
                break outer;
              }
              break;
            }
          }
        }

        leftUnbounded = leftUnboundedCheckReaderNext.value;
      }

      if (!leftUnbounded) {
        leftAndRightUnbounded = false;
      } else {
        const rightUnboundedReader = isUnboundedReader({
          multiLine: input.multiLine,
          reader: fork(streamReadersWithGetters[1].reader),
        });
        let rightUnboundedCheckReaderNext: ReaderResult<
          IsUnboundedReaderValue,
          boolean
        >;
        while (
          !(rightUnboundedCheckReaderNext = rightUnboundedReader.next()).done
        ) {
          switch (rightUnboundedCheckReaderNext.value.type) {
            case isUnboundedReaderTypeStep: {
              stepCount += 0.5;
              /* istanbul ignore next */
              if (stepCount > input.maxSteps) {
                break outer;
              }
              break;
            }
          }
        }
        const rightUnbounded = rightUnboundedCheckReaderNext.value;
        leftAndRightUnbounded = rightUnbounded;
      }

      // if both sides are unbounded then it means a backtrack won't occur
      // from one side to the other if an invalid character is hit (e.g. `^a*a*`),
      // so bail
      if (leftAndRightUnbounded) {
        continue;
      }

      const shouldEmitTrail = (): boolean => {
        const alreadyExists = [...trails].some((existingTrail) => {
          if (existingTrail.length !== trail.length) return false;

          return (
            existingTrail.every(
              (existingEntry, i) =>
                sidesEqualChecker.areSidesEqual(
                  existingEntry.left,
                  trail[i].right,
                ) &&
                sidesEqualChecker.areSidesEqual(
                  existingEntry.right,
                  trail[i].left,
                ),
            ) ||
            existingTrail.every(
              (existingEntry, i) =>
                sidesEqualChecker.areSidesEqual(
                  existingEntry.left,
                  trail[i].left,
                ) &&
                sidesEqualChecker.areSidesEqual(
                  existingEntry.right,
                  trail[i].right,
                ),
            )
          );
        });

        return !alreadyExists;
      };

      if (shouldEmitTrail()) {
        trails.add(trail);
        yield { trail, type: checkerReaderTypeTrail };
      }
    }

    stack.push({
      infiniteLoopTracker,
      streamReadersWithGetters: streamReadersWithGetters.map(({ reader }) => ({
        get: once(() => reader.next()),
        reader,
      })),
      trail,
    });
  }

  let infinite = false;
  if (trailEntriesAtStartOfLoop.size > 0) {
    for (const trail of trails) {
      if (trail.some((entry) => trailEntriesAtStartOfLoop.has(entry))) {
        infinite = true;
        break;
      }
    }
  }

  const error =
    stepCount > input.maxSteps
      ? ('hitMaxSteps' as const)
      : timedOut
      ? ('timedOut' as const)
      : null;

  return error
    ? {
        error,
      }
    : { error: null, infinite };
}
