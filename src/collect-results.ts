import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeInfiniteLoop,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
} from './checker-reader';
import { areArraysEqual } from './arrays';
import { buildCharacterReaderLevel2 } from './character-reader/character-reader-level-2';
import { buildNodeExtra } from './node-extra';
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
  caseInsensitive: boolean;
  dotAll: boolean;
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
  caseInsensitive,
  dotAll,
}: CollectResultsInput): WalkerResult {
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
    rightStreamReader,
    timeout,
  });

  let trails: Trail[] = [];
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
          const samePrefix =
            trail.length >= existingTrail.length &&
            areArraysEqual(trail.slice(0, existingTrail.length), existingTrail);
          return !samePrefix;
        });
        trails = [...trails, trail];
        if (infiniteBacktracks || trails.length > maxBacktracks) {
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
    } else if (!trails.length) {
      worstCaseBacktrackCount = 0;
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
