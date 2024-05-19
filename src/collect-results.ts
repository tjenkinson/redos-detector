import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
} from './checker-reader';
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
    multiLine,
    rightStreamReader,
    timeout,
  });

  let trails: Trail[] = [];
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeTrail: {
        const trail = next.value.trail;
        trails = [...trails, trail];
        if (trails.length > maxBacktracks) {
          break outer;
        }
        break;
      }
    }
  }

  let worstCaseBacktrackCount = trails.length;

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
    trails,
    worstCaseBacktrackCount,
  };
}
