import {
  buildCheckerReader,
  CheckerReaderReturn,
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
  let next: ReaderResult<Trail, CheckerReaderReturn>;
  let i = 0;
  while (!(next = reader.next()).done) {
    if (i++ >= maxResults) {
      break;
    }
    trails.push(next.value);
  }

  return {
    error: next.done ? next.value.error : ('hitMaxResults' as const),
    trails,
  };
}
