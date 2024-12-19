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

const workLimit = 25_000;

class EnhancedTrail {
  public readonly length: number;
  private readonly inputStringSchema: readonly CharacterGroups[];
  private readonly tree = new Tree<readonly TrailEntrySide[]>((trail) =>
    trail.map(({ hash }) => hash),
  );

  public get matches(): readonly (readonly TrailEntrySide[])[] {
    return this.tree.items;
  }

  private isEmptyCache: ResultCache<boolean, CharacterGroups> =
    new ResultCache();

  private getLongestMatch(
    inputStringSchema: readonly CharacterGroups[],
    trailSides: readonly TrailEntrySide[],
  ): readonly TrailEntrySide[] {
    /* istanbul ignore next */
    if (trailSides.length > inputStringSchema.length) {
      throw new Error(
        'Internal error: trail should be <= than input string schema',
      );
    }
    const noMatchOffset = trailSides.findIndex((side, i) => {
      const res = this.isEmptyCache.getResult(
        side.characterGroups,
        inputStringSchema[i],
      );
      if (res !== undefined) return res;

      const isEmpty = isEmptyCharacterGroups(
        intersectCharacterGroups(side.characterGroups, inputStringSchema[i]),
      );
      this.isEmptyCache.addResult(
        side.characterGroups,
        inputStringSchema[i],
        isEmpty,
      );
      return isEmpty;
    });

    return noMatchOffset === -1
      ? trailSides
      : trailSides.slice(0, noMatchOffset);
  }

  constructor(public readonly trail: Trail) {
    this.inputStringSchema = trail.map(({ intersection }) => intersection);
    this.length = trail.length;
    this.onNewTrail(this);
  }

  public onNewTrail(otherTrail: EnhancedTrail): void {
    const leftSide: TrailEntrySide[] = [];
    const rightSide: TrailEntrySide[] = [];
    for (const entry of otherTrail.trail) {
      leftSide.push(entry.left);
      rightSide.push(entry.right);
    }

    const leftMatch = this.getLongestMatch(this.inputStringSchema, leftSide);
    if (leftMatch.length === this.length) this.tree.add(leftMatch);

    const rightMatch = this.getLongestMatch(this.inputStringSchema, rightSide);
    if (rightMatch.length === this.length) this.tree.add(rightMatch);
  }
}

export type CollectResultsResult = Readonly<{
  error: RedosDetectorError | null;
  trails: readonly Trail[];
  score: number;
}>;

export type CollectResultsInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  caseInsensitive: boolean;
  dotAll: boolean;
  maxScore: number;
  maxSteps: number;
  multiLine: boolean;
  node: MyRootNode;
  timeout: number;
}>;

export function collectResults({
  atomicGroupOffsets,
  node,
  maxScore,
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
  let score = 1;
  let work = 0;
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeTrail: {
        const trail = new EnhancedTrail(next.value.trail);

        const updateScore = ({ matches }: EnhancedTrail): void => {
          const { length } = matches;
          if (length > score) {
            score = length;
          }
        };

        if (work < workLimit) {
          for (const existingTrail of trailsTree.items) {
            if (existingTrail.length === trail.length) {
              work += trail.length;
              if (work >= workLimit) break;

              trail.onNewTrail(existingTrail);
              existingTrail.onNewTrail(trail);
              updateScore(existingTrail);
            }
          }
          updateScore(trail);
        }

        if (work >= workLimit) {
          // it's too costly to continue calculating an accurate count, so fall back to assuming the input string that matches the largest
          // group of trails would also match every new trail
          score += 1;
        }

        trailsTree.add(trail);

        if (score > maxScore) {
          break outer;
        }
        break;
      }
    }
  }

  let error: RedosDetectorError | null = null;
  if (next.done) {
    if (next.value.error) {
      score = Infinity;
      error = next.value.error;
    } else if (next.value.infinite) {
      score = Infinity;
      error = 'hitMaxScore';
    }
  } else {
    score = Infinity;
    error = 'hitMaxScore';
  }

  return {
    error,
    score,
    trails: trailsTree.items.map(({ trail }) => trail),
  };
}
