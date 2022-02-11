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

export type WalkerResult = Readonly<{
  error: 'hitMaxResults' | 'hitMaxSteps' | 'stackOverflow' | 'timedOut' | null;
  trails: readonly Trail[];
}>;

export type CollectResultsInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  maxResults: number;
  maxSteps: number;
  node: MyRootNode;
  timeout: number;
}>;

export function collectResults({
  atomicGroupOffsets,
  node,
  maxResults,
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
  let i = 0;
  outer: while (!(next = reader.next()).done) {
    switch (next.value.type) {
      case checkerReaderTypeInfiniteResults: {
        break;
      }
      case checkerReaderTypeTrail: {
        if (i++ >= maxResults) {
          break outer;
        }
        trails.push(next.value.trail);
        break;
      }
    }
  }

  return {
    error: next.done ? next.value.error : ('hitMaxResults' as const),
    trails,
  };
}
