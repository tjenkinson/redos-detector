import { areSetsEqual, setsOverlap } from './sets';
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
  CharacterReaderLevel2,
  CharacterReaderLevel2ReturnValue,
  characterReaderLevel2TypeEntry,
  characterReaderLevel2TypeSplit,
  CharacterReaderLevel2Value,
} from './character-reader/character-reader-level-2';
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
import {
  isUnboundedReader,
  isUnboundedReaderTypeStack,
  IsUnboundReaderValue,
} from './is-unbounded-reader';
import { fork } from 'forkable-iterator';
import { InfiniteLoopTracker } from './infinite-loop-tracker';
import { last } from './arrays';
import { MyFeatures } from './parse';
import { once } from './once';
import { SidesEqualChecker } from './sides-equal-checker';

export type CheckerInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  leftStreamReader: CharacterReaderLevel2;
  maxSteps: number;
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
  'checkerReaderTypeTrail',
);
export const checkerReaderTypeInfiniteLoop: unique symbol = Symbol(
  'checkerReaderTypeInfiniteLoop',
);

export type CheckerReaderValueTrail = Readonly<{
  trail: Trail;
  type: typeof checkerReaderTypeTrail;
}>;
export type CheckerReaderValueInfiniteLoop = Readonly<{
  type: typeof checkerReaderTypeInfiniteLoop;
}>;
export type CheckerReaderValue =
  | CheckerReaderValueInfiniteLoop
  | CheckerReaderValueTrail;

// eslint-disable-next-line no-use-before-define
export type CheckerReader = Reader<CheckerReaderValue, CheckerReaderReturn>;
export type CheckerReaderReturn = Readonly<{
  error: 'hitMaxSteps' | 'stackOverflow' | 'timedOut' | null;
}>;

const stackOverflowLimit = 1000;

type NodeWithQuantifierTrail = Readonly<{
  node: AstNode<MyFeatures>;
  quantifierTrail: string;
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
  infiniteLoopTracker: InfiniteLoopTracker<NodeWithQuantifierTrail>;
  streamReadersWithGetters: ReaderWithGetter[];
  trail: Trail;
}>;

const isNodeWithQuantifierTrailEqual = (
  left: NodeWithQuantifierTrail,
  right: NodeWithQuantifierTrail,
): boolean =>
  left.node === right.node && left.quantifierTrail === right.quantifierTrail;

/**
 * Takes a left and right `CharacterReaderLevel2` and runs them against each other.
 *
 * Emits a trail when left and right differ, as it means there are 2 different ways of matching the same
 * trail up to that point.
 */
export function* buildCheckerReader(input: CheckerInput): CheckerReader {
  const sidesEqualChecker = new SidesEqualChecker();
  const trails = new Set<Trail>();
  let stepCount = 0;
  const latestEndTime = Date.now() + input.timeout;
  let timedOut = false;
  let stackOverflow = false;

  const initialLeftStreamReader = buildForkableReader(input.leftStreamReader);
  const initialRightStreamReader = buildForkableReader(input.rightStreamReader);

  const stack: StackFrame[] = [
    {
      infiniteLoopTracker: new InfiniteLoopTracker(
        isNodeWithQuantifierTrailEqual,
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
    stackOverflow = stack.length > stackOverflowLimit;
    if (timedOut || stackOverflow || stepCount > input.maxSteps) {
      break;
    }

    const entry = stack.pop();
    if (!entry) break;

    const { streamReadersWithGetters } = entry;
    let { infiniteLoopTracker, trail } = entry;

    const nextValues: ReaderResult<
      CharacterReaderLevel2Value,
      CharacterReaderLevel2ReturnValue
    >[] = [];

    for (let i = 0; i < streamReadersWithGetters.length; i++) {
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
      ++stepCount > input.maxSteps ||
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

    const leftPassedStartAnchor = leftValue.preceedingZeroWidthEntries.some(
      ({ type }) => type === 'start',
    );
    const rightPassedStartAnchor = rightValue.preceedingZeroWidthEntries.some(
      ({ type }) => type === 'start',
    );
    const somethingPassedStartAnchor =
      leftPassedStartAnchor || rightPassedStartAnchor;

    if (
      (trail.length > 0 && somethingPassedStartAnchor) ||
      leftPassedStartAnchor !== rightPassedStartAnchor
    ) {
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

    const leftQuantifiersInInfiniteProportion =
      buildQuantifiersInInfinitePortion(leftValue.quantifierStack);
    const rightQuantifiersInInfiniteProportion =
      buildQuantifiersInInfinitePortion(rightValue.quantifierStack);

    if (
      setsOverlap(
        leftQuantifiersInInfiniteProportion,
        rightQuantifiersInInfiniteProportion,
      )
    ) {
      const leftAndRightIdentical = trail.every(({ left, right }) =>
        sidesEqualChecker.areSidesEqual(left, right),
      );
      if (leftAndRightIdentical) {
        // left and right have been identical to each other, and we are now entering an infinite
        // portion, so bail
        continue;
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
            true,
          ),
        },
        {
          node: rightValue.node,
          quantifierTrail: buildQuantifierTrail(
            rightValue.quantifierStack,
            true,
          ),
        },
      );
    } else {
      infiniteLoopTracker = new InfiniteLoopTracker(
        isNodeWithQuantifierTrailEqual,
      );
    }

    if (infiniteLoopTracker.isLooping()) {
      if (leftValue.node === rightValue.node) {
        yield { type: checkerReaderTypeInfiniteLoop };
      }
      continue;
    }

    const intersection = intersectCharacterGroups(
      leftValue.characterGroups,
      rightValue.characterGroups,
    );

    if (isEmptyCharacterGroups(intersection)) {
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

    const newEntry: TrailEntry = {
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
    };

    trail = [...trail, newEntry];

    let backtrackPossible: boolean;

    const sidesEqual = sidesEqualChecker.areSidesEqual(
      newEntry.left,
      newEntry.right,
    );

    if (sidesEqual) {
      backtrackPossible = false;
    } else {
      let leftAndRightUnbounded: boolean;
      let leftUnbounded: boolean;
      {
        let additionalStackSize = 0;
        const leftUnboundedReader = isUnboundedReader(
          fork(streamReadersWithGetters[0].reader),
        );
        let leftUnboundedCheckReaderNext: ReaderResult<
          IsUnboundReaderValue,
          boolean
        >;
        while (
          !(leftUnboundedCheckReaderNext = leftUnboundedReader.next()).done
        ) {
          switch (leftUnboundedCheckReaderNext.value.type) {
            case isUnboundedReaderTypeStack: {
              additionalStackSize +=
                leftUnboundedCheckReaderNext.value.increase;
              /* istanbul ignore next */
              if (stack.length + additionalStackSize > stackOverflowLimit) {
                stackOverflow = true;
                break outer;
              }
            }
          }
        }

        leftUnbounded = leftUnboundedCheckReaderNext.value;
      }

      if (!leftUnbounded) {
        leftAndRightUnbounded = false;
      } else {
        let additionalStackSize = 0;
        const rightUnboundedReader = isUnboundedReader(
          fork(streamReadersWithGetters[1].reader),
        );
        let rightUnboundedCheckReaderNext: ReaderResult<
          IsUnboundReaderValue,
          boolean
        >;
        while (
          !(rightUnboundedCheckReaderNext = rightUnboundedReader.next()).done
        ) {
          switch (rightUnboundedCheckReaderNext.value.type) {
            case isUnboundedReaderTypeStack: {
              additionalStackSize +=
                rightUnboundedCheckReaderNext.value.increase;
              /* istanbul ignore next */
              if (stack.length + additionalStackSize > stackOverflowLimit) {
                stackOverflow = true;
                break outer;
              }
            }
          }
        }
        const rightUnbounded = rightUnboundedCheckReaderNext.value;
        leftAndRightUnbounded = rightUnbounded;
      }

      // if both sides are unbounded then it means a backtrack won't occur
      // from one side to the other if an invalid character is hit (e.g. `^a*a*`),
      // so don't emit the trail
      backtrackPossible = !leftAndRightUnbounded;
    }

    if (backtrackPossible) {
      const shouldSendTrail = (): boolean => {
        if (!trails.has(trail)) {
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

          if (!alreadyExists) {
            return true;
          }
        }
        return false;
      };

      if (shouldSendTrail()) {
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
