import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeInfiniteLoop,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
} from './checker-reader';
import { areArraysEqual } from './arrays';
import { buildCharacterReaderWithReferences } from './character-reader-with-references';
import { buildNodeExtra } from './node-extra';
import { getOrCreate } from './map';
import { MyRootNode } from './parse';
import { ReaderResult } from './reader';
import { RedosDetectorError } from './redos-detector';

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
  const reader = buildCheckerReader({
    atomicGroupOffsets,
    leftStreamReader,
    maxSteps,
    rightStreamReader,
    timeout,
  });

  let trails: Trail[] = [];
  const trailsByLength: Map<number, Set<Trail>> = new Map();
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;
  let infiniteBacktracks = false;

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeInfiniteLoop: {
        infiniteBacktracks = true;
        if (trails.length > 0) {
          break outer;
        }
        break;
      }
      case checkerReaderTypeTrail: {
        const trail = next.value.trail;
        trails = trails.filter((existingTrail) => {
          const samePreix =
            trail.length >= existingTrail.length &&
            areArraysEqual(trail.slice(0, existingTrail.length), existingTrail);
          return !samePreix;
        });
        trails = [...trails, trail];
        getOrCreate(trailsByLength, trail.length, () => new Set()).add(trail);
        if (infiniteBacktracks) {
          break outer;
        }
        break;
      }
    }
  }

  let worstCaseBacktrackCount = infiniteBacktracks ? Infinity : trails.length;

  let error: RedosDetectorError | null = null;
  if (next.done) {
    if (next.value.error) {
      worstCaseBacktrackCount = Infinity;
      error = next.value.error;
    } else {
      if (!trails.length) {
        worstCaseBacktrackCount = 0;
      }
      if (
        worstCaseBacktrackCount > maxBacktracks ||
        worstCaseBacktrackCount === Infinity
      ) {
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
