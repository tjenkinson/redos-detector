import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeInfiniteResults,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
} from './checker-reader';
import { buildCharacterReaderWithReferences } from './character-reader-with-references';
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

  const trails: Trail[] = [];
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;
  let infiniteResults = false;

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeInfiniteResults: {
        infiniteResults = true;
        break;
      }
      case checkerReaderTypeTrail: {
        trails.push(next.value.trail);
        if (infiniteResults) {
          break outer;
        }
        break;
      }
    }
  }

  let worstCaseBacktrackCount = infiniteResults ? Infinity : trails.length;

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
