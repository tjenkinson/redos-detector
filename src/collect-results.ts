import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeInfiniteResults,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
  TrailEntrySide,
} from './checker-reader';
import {
  intersectCharacterGroups,
  isEmptyCharacterGroups,
} from './character-groups';
import { buildCharacterReaderWithReferences } from './character-reader-with-references';
import { buildNodeExtra } from './node-extra';
import { MyRootNode } from './parse';
import { ReaderResult } from './reader';
import { RedosDetectorError } from './redos-detector';
import { SidesEqualChecker } from './sides-equal-checker';

export type WalkerResult = Readonly<{
  error: RedosDetectorError | null;
  trails: readonly Trail[];
  worstCaseBacktrackCount: number;
}>;

export type CollectResultsInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  maxBacktracks: number;
  maxSteps: number;
  node: MyRootNode;
  timeout: number;
}>;

function trailsCouldMatchSameInput(a: Trail, b: Trail): boolean {
  if (a === b) return true;
  return (
    a.length === b.length &&
    a.every(({ intersection: aIntersection }, i) => {
      const bIntersection = b[i].intersection;
      return !isEmptyCharacterGroups(
        intersectCharacterGroups(aIntersection, bIntersection)
      );
    })
  );
}

export function collectResults({
  atomicGroupOffsets,
  node,
  maxBacktracks,
  maxSteps,
  timeout,
}: CollectResultsInput): WalkerResult {
  const nodeExtra = buildNodeExtra(node);
  const leftStreamReader = buildCharacterReaderWithReferences(node, nodeExtra);
  const rightStreamReader = buildCharacterReaderWithReferences(node, nodeExtra);
  const sidesEqualChecker = new SidesEqualChecker();

  const reader = buildCheckerReader({
    atomicGroupOffsets,
    leftStreamReader,
    maxSteps,
    rightStreamReader,
    sidesEqualChecker,
    timeout,
  });

  const trails: Trail[] = [];
  // for a given trail, store the sides of any trails that could also match the same input string
  const trailToMatchingTrailsGroupSides: Map<
    Trail,
    Set<readonly TrailEntrySide[]>
  > = new Map();
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;
  let worstCaseBacktrackCount = 0;

  const addTrailSidesToGroup = (
    groupSides: Set<readonly TrailEntrySide[]>,
    trail: Trail
  ): void => {
    const leftSide: TrailEntrySide[] = [];
    const rightSide: TrailEntrySide[] = [];
    for (const { left, right } of trail) {
      leftSide.push(left);
      rightSide.push(right);
    }

    let hasLeft = false;
    let hasRight = false;
    for (const side of groupSides) {
      if (
        !hasLeft &&
        side.every((entry, i) =>
          sidesEqualChecker.areSidesEqual(entry, leftSide[i])
        )
      ) {
        hasLeft = true;
      }
      if (
        !hasRight &&
        side.every((entry, i) =>
          sidesEqualChecker.areSidesEqual(entry, rightSide[i])
        )
      ) {
        hasRight = true;
      }
    }
    if (!hasLeft) groupSides.add(leftSide);
    if (!hasRight) groupSides.add(rightSide);
  };

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeInfiniteResults: {
        worstCaseBacktrackCount = Infinity;
        break;
      }
      case checkerReaderTypeTrail: {
        trails.push(next.value.trail);
        if (worstCaseBacktrackCount === Infinity) {
          break outer;
        }
        trailToMatchingTrailsGroupSides.set(next.value.trail, new Set());
        for (const [trail, groupSides] of trailToMatchingTrailsGroupSides) {
          if (trailsCouldMatchSameInput(trail, next.value.trail)) {
            addTrailSidesToGroup(groupSides, next.value.trail);
            worstCaseBacktrackCount = Math.max(
              worstCaseBacktrackCount,
              groupSides.size - 1
            );
            if (worstCaseBacktrackCount >= maxBacktracks) {
              break outer;
            }
          }
        }
        break;
      }
    }
  }

  let error: RedosDetectorError | null = null;
  if (next.done) {
    if (next.value.error) {
      worstCaseBacktrackCount = Infinity;
      error = next.value.error;
    } else {
      if (!trails.length) {
        worstCaseBacktrackCount = 0;
      }
      if (worstCaseBacktrackCount >= maxBacktracks) {
        error = 'hitMaxBacktracks';
      }
    }
  } else {
    worstCaseBacktrackCount = Infinity;
    error = 'hitMaxBacktracks';
  }

  return {
    error,
    trails,
    worstCaseBacktrackCount,
  };
}
