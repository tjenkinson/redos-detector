import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
  TrailEntrySide,
} from './checker-reader';
import {
  CharacterGroups,
  intersectCharacterGroups,
  isEmptyCharacterGroups,
} from './character-groups';
import { buildCharacterReaderLevel2 } from './character-reader/character-reader-level-2';
import { buildNodeExtra } from './node-extra';
import { MyRootNode } from './parse';
import { ReaderResult } from './reader';
import { RedosDetectorError } from './redos-detector';
import { ResultCache } from './result-cache';
import { Tree } from './tree';

const isEmptyCache: ResultCache<boolean, CharacterGroups> = new ResultCache();

function getLongestMatch(
  inputStringSchema: readonly CharacterGroups[],
  trailSides: readonly TrailEntrySide[],
): readonly TrailEntrySide[] {
  const noMatchOffset = trailSides.findIndex((side, i) => {
    if (i >= inputStringSchema.length) return true;
    const res = isEmptyCache.getResult(
      side.characterGroups,
      inputStringSchema[i],
    );
    if (res !== undefined) return res;

    const isEmpty = isEmptyCharacterGroups(
      intersectCharacterGroups(side.characterGroups, inputStringSchema[i]),
    );
    isEmptyCache.addResult(side.characterGroups, inputStringSchema[i], isEmpty);
    return isEmpty;
  });

  return noMatchOffset === -1 ? trailSides : trailSides.slice(0, noMatchOffset);
}

class EnhancedTrail {
  private readonly inputStringSchema: readonly CharacterGroups[];
  private readonly tree = new Tree<readonly TrailEntrySide[]>((x) => x);

  public get otherPotentialMatches(): readonly (readonly TrailEntrySide[])[] {
    return this.tree.items;
  }

  constructor(public readonly trail: Trail) {
    this.inputStringSchema = trail.map(({ intersection }) => intersection);
    this.onNewTrail(this);
  }

  public onNewTrail(otherTrail: EnhancedTrail): void {
    const leftSide: TrailEntrySide[] = [];
    const rightSide: TrailEntrySide[] = [];
    for (const entry of otherTrail.trail) {
      leftSide.push(entry.left);
      rightSide.push(entry.right);
    }

    const leftMatch = getLongestMatch(this.inputStringSchema, leftSide);
    if (leftMatch.length > 0) this.tree.add(leftMatch);

    const rightMatch = getLongestMatch(this.inputStringSchema, rightSide);
    if (rightMatch.length > 0) this.tree.add(rightMatch);
  }
}

export type CollectResultsTrail = {
  trail: Trail;
  otherPotentialMatches: readonly (readonly TrailEntrySide[])[];
};

export type CollectResultsResult = Readonly<{
  error: RedosDetectorError | null;
  trails: readonly CollectResultsTrail[];
  worstCaseBacktrackCount: number;
}>;

export type CollectResultsInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  caseInsensitive: boolean;
  dotAll: boolean;
  maxBacktracks: number;
  maxSteps: number;
  multiLine: boolean;
  node: MyRootNode;
  timeout: number;
}>;

export function collectResults({
  atomicGroupOffsets,
  node,
  maxBacktracks,
  maxSteps,
  multiLine,
  timeout,
  caseInsensitive,
  dotAll,
}: CollectResultsInput): CollectResultsResult {
  const nodeExtra = buildNodeExtra(node);
  const input = {
    caseInsensitive,
    dotAll,
    node,
    nodeExtra,
  };
  const leftStreamReader = buildCharacterReaderLevel2(input);
  const rightStreamReader = buildCharacterReaderLevel2(input);
  const reader = buildCheckerReader({
    atomicGroupOffsets,
    leftStreamReader,
    maxSteps,
    multiLine,
    rightStreamReader,
    timeout,
  });

  const trailsTree: Tree<EnhancedTrail> = new Tree(({ trail }) => trail);
  let worstCaseBacktrackCount = 0;
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeTrail: {
        const trail = new EnhancedTrail(next.value.trail);

        for (const existingTrail of trailsTree.items) {
          trail.onNewTrail(existingTrail);
          existingTrail.onNewTrail(trail);
        }

        trailsTree.add(trail);

        worstCaseBacktrackCount =
          Math.max(
            ...trailsTree.items.map(
              ({ otherPotentialMatches }) => otherPotentialMatches.length,
            ),
          ) - 1;

        if (worstCaseBacktrackCount > maxBacktracks) {
          break outer;
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
    } else if (next.value.infinite) {
      worstCaseBacktrackCount = Infinity;
      error = 'hitMaxBacktracks';
    }
  } else {
    worstCaseBacktrackCount = Infinity;
    error = 'hitMaxBacktracks';
  }

  return {
    error,
    trails: trailsTree.items.map(({ otherPotentialMatches, trail }) => {
      return {
        otherPotentialMatches,
        trail,
      };
    }),
    worstCaseBacktrackCount,
  };
}
