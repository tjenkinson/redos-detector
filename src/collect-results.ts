import {
  buildCheckerReader,
  CheckerReaderReturn,
  checkerReaderTypeInfiniteLoop,
  checkerReaderTypeTrail,
  CheckerReaderValue,
  Trail,
} from './checker-reader';
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

  const trails: Trail[] = [];
  const trailsByLength: Map<number, Set<Trail>> = new Map();
  let next: ReaderResult<CheckerReaderValue, CheckerReaderReturn>;
  let potentiallyInfiniteResults = false;
  let infiniteBacktracks = false;

  const calculateInfiniteBacktracks = (): void => {
    // if the reader hit an infinite loop, but all the trails are different lengths,
    // then there aren't infinite backtracks given the input string would be a fixed
    // length
    infiniteBacktracks =
      potentiallyInfiniteResults &&
      [...trailsByLength].some(([, trailsAtLength]) => {
        return trailsAtLength.size > 1;
      });
  };

  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeInfiniteLoop: {
        potentiallyInfiniteResults = true;
        calculateInfiniteBacktracks();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (infiniteBacktracks && trails.length > 0) {
          break outer;
        }
        break;
      }
      case checkerReaderTypeTrail: {
        const trail = next.value.trail;
        trails.push(trail);
        getOrCreate(trailsByLength, trail.length, () => new Set()).add(trail);
        calculateInfiniteBacktracks();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (infiniteBacktracks) {
          break outer;
        }
        break;
      }
    }
  }

  // Infinity, or get the highest number of trails that match an input string of the same length.
  // This is not perfect (i.e `a|a|b|b` would not split 2 groups, even though if the input is `a` it could not be `b`),
  // but the trade off is that it should be performant and never underreport
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
