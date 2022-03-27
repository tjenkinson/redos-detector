import { MyFeatures, parse } from './parse';
import _version from 'package-json:version';
import { AstNode } from 'regjsparser';
import { BackReferenceStack } from './character-reader/character-reader-level-1';
import { collectResults } from './collect-results';
import { downgradePattern as downgradePatternFn } from './downgrade-pattern';
import { QuantifierStack } from './nodes/quantifier';

export { downgradePattern, DowngradePatternConfig } from './downgrade-pattern';
export * from './to-friendly';

/**
 * The current version.
 */
export const version = _version;

export type RedosDetectorNodeLocation = {
  /**
   * The first character in the pattern has offset `0`.
   */
  readonly offset: number;
};

export type RedosDetectorNode = {
  /**
   * The end location of the node (exclusive).
   */
  readonly end: RedosDetectorNodeLocation;
  /**
   * The contents of the node.
   */
  readonly source: string;
  /**
   * The start location of the node (inclusive).
   */
  readonly start: RedosDetectorNodeLocation;
};

export type RedosDetectorBackReference = {
  /**
   * The index of the capturing group the backreference points at.
   * The first group has index `1`.
   */
  readonly index: number;
  /**
   * The back refernce node.
   */
  readonly node: RedosDetectorNode;
};

export type RedosDetectorBackReferenceStack =
  readonly RedosDetectorBackReference[];

export type RedosDetectorQuantifierIteration = {
  /**
   * The iteration number. The first iteration is `0`.
   */
  readonly iteration: number;
  /**
   * The quantifier node.
   */
  readonly node: RedosDetectorNode;
};

export type RedosDetectorQuantifierIterations =
  readonly RedosDetectorQuantifierIteration[];

export type RedosDetectorTrailEntrySide = {
  /**
   * If not `null`, this means the current node is part of the backreference.
   */
  readonly backreferenceStack: RedosDetectorBackReferenceStack;
  /**
   * The node.
   */
  readonly node: RedosDetectorNode;
  /**
   * The iteration of each quantifier the current node is part of.
   */
  readonly quantifierIterations: RedosDetectorQuantifierIterations;
};

export type RedosDetectorTrailEntry = {
  readonly a: RedosDetectorTrailEntrySide;
  readonly b: RedosDetectorTrailEntrySide;
};

export type RedosDetectorTrail = {
  /**
   * A trail.
   */
  readonly trail: readonly RedosDetectorTrailEntry[];
};

export type IsSafeConfig = {
  /**
   * If worst case count of possible backtracks is above this number,
   * the regex will be considered unsafe.
   */
  readonly maxBacktracks?: number;
  /**
   * The maximum number of steps to make. Every time a new node is read
   * from the pattern this counts as one step. If this limit is hit `error`
   * will be `hitMaxSteps`.
   *
   * Note it's possible for there to be a infinite number of results,
   * and therefore an inifinite number of steps.
   */
  readonly maxSteps?: number;
  /**
   * The maximum amount of time (ms) to spend processing. Once this time
   * is passed the trails found so far will be returned, and the `error`
   * will be `timeout`.
   *
   * Note it's possible for there to be a infinite number of results.
   */
  readonly timeout?: number;
} & (
  | {
      /**
       * The offsets of groups which should be considered atomic.
       * This is an advanced option you probably never want to use.
       *
       * It exists because sometimes when a patten is downgraded, some of
       * the groups in the downgrade can be considered atomic.
       */
      readonly atomicGroupOffsets?: ReadonlySet<number>;
      /**
       * Do not downgrade the pattern if it's not supported as is.
       *
       * An exception may be thrown if the pattern needed to be downgraded.
       */
      readonly downgradePattern?: false;
    }
  | {
      readonly atomicGroupOffsets?: undefined;
      /**
       * Automatically downgrade the pattern if it's not supported as is.
       *
       * If this happens `patternDowngraded` will be `true` and `pattern`
       * will contain the downgraded version.
       *
       * You can downgrade the pattern yourself with `downgradePattern`.
       */
      readonly downgradePattern: true;
    }
);

export type RedosDetectorError =
  | 'hitMaxBacktracks'
  | 'hitMaxSteps'
  | 'stackOverflow'
  | 'timedOut';

export type BacktrackCount =
  | { infinite: false; value: number }
  | { infinite: true };

export type RedosDetectorResult = {
  /**
   * The pattern that was checked. If it was downgraded this will be
   * the downgraded version.
   */
  readonly pattern: string;
  /**
   * `true` if the pattern needed to be downgraded.
   */
  readonly patternDowngraded: boolean;
  /**
   * An array of trails. Each trail shows 2 different ways through the pattern
   * side by side.
   *
   * For every trail there's an input string that could
   * match the regex multiple ways if backtracking occurred.
   */
  readonly trails: RedosDetectorTrail[];
  /**
   * The worst case number of backtracks that could occur on an input string.
   *
   * Note it's possible for this to be higher than the true number.
   *
   * If it's infinite the `infinite` property will be `true`, otherwise the number
   * will be on `value`.
   */
  readonly worstCaseBacktrackCount: BacktrackCount;
} & (
  | {
      /**
       * `null` means no error occurred.
       */
      readonly error: null;
      /**
       * `true` means the regex pattern is not susceptible to ReDoS attacks
       * based on the configured `maxBacktracks` option.
       */
      readonly safe: true;
    }
  | {
      /**
       * The error that occurred.
       *
       * `trails` will still contain the trails that were found before
       *  the error occurred.
       */
      readonly error: RedosDetectorError;
      /**
       * `false` means the regex pattern is susceptible to ReDoS attacks.
       */
      readonly safe: false;
    }
);

export type IsSafePatternConfig = IsSafeConfig & {
  /**
   * Enable unicode mode.
   */
  readonly unicode?: boolean;
};

export const defaultTimeout = Infinity;
export const defaultMaxBacktracks = 200;
export const defaultMaxSteps = 20000;
export const defaultUnicode = false;
const supportedJSFlags: ReadonlySet<string> = new Set(['u', 'g', 's', 'y']);

type PatternWithAtomicGroupOffsets = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  pattern: string;
}>;

function toRedosDetectorNode(node: AstNode<MyFeatures>): RedosDetectorNode {
  return {
    end: { offset: node.range[1] },
    source: node.raw,
    start: { offset: node.range[0] },
  };
}

function toRedosDetectorBackReferenceStack(
  backreferenceStack: BackReferenceStack
): RedosDetectorBackReferenceStack {
  return backreferenceStack.map((reference) => {
    return {
      index: reference.matchIndex,
      node: toRedosDetectorNode(reference),
    };
  });
}

function toRedosDetectorQuantifierIterations(
  stack: QuantifierStack
): RedosDetectorQuantifierIterations {
  return stack.map(({ quantifier, iteration }) => {
    return {
      iteration,
      node: toRedosDetectorNode(quantifier),
    };
  });
}

/**
 * Check if the provided input pattern is not susceptible to ReDoS attacks.
 *
 * Can be configured with various options in the second argument.
 */
export function isSafePattern(
  inputPattern: string,
  {
    atomicGroupOffsets: atomicGroupOffsetsInput,
    maxBacktracks = defaultMaxBacktracks,
    maxSteps = defaultMaxSteps,
    timeout = defaultTimeout,
    unicode = defaultUnicode,
    downgradePattern = true,
  }: IsSafePatternConfig = {}
): RedosDetectorResult {
  if (downgradePattern && atomicGroupOffsetsInput) {
    throw new Error(
      '`atomicGroupOffsets` cannot be used with `downgradePattern: true`.'
    );
  }
  if (timeout <= 0) {
    throw new Error('`timeout` must be a positive number.');
  }
  if (maxBacktracks < 0) {
    throw new Error('`maxBacktracks` must be a positive number or 0.');
  }
  if (maxSteps <= 0) {
    throw new Error('`maxSteps` must be a positive number.');
  }

  const { pattern, atomicGroupOffsets }: PatternWithAtomicGroupOffsets =
    downgradePattern
      ? downgradePatternFn({ pattern: inputPattern, unicode })
      : { atomicGroupOffsets: new Set(), pattern: inputPattern };

  const patternDowngraded = downgradePattern && inputPattern !== pattern;

  const ast = parse(pattern, unicode);

  const result = collectResults({
    atomicGroupOffsets,
    maxBacktracks,
    maxSteps,
    node: ast,
    timeout,
  });

  return {
    ...(result.error
      ? {
          error: result.error,
          safe: false,
        }
      : {
          error: null,
          safe: true,
        }),
    pattern,
    patternDowngraded,
    trails: result.trails.map((trail) => {
      const safeRegexTrail: RedosDetectorTrail = {
        trail: trail.map(({ left, right }) => {
          const entry: RedosDetectorTrailEntry = {
            a: {
              backreferenceStack: toRedosDetectorBackReferenceStack(
                right.backreferenceStack
              ),
              node: toRedosDetectorNode(right.node),
              quantifierIterations: toRedosDetectorQuantifierIterations(
                right.quantifierStack
              ),
            },
            b: {
              backreferenceStack: toRedosDetectorBackReferenceStack(
                left.backreferenceStack
              ),
              node: toRedosDetectorNode(left.node),
              quantifierIterations: toRedosDetectorQuantifierIterations(
                left.quantifierStack
              ),
            },
          };
          return entry;
        }),
      };
      return safeRegexTrail;
    }),
    worstCaseBacktrackCount:
      result.worstCaseBacktrackCount === Infinity
        ? { infinite: true }
        : { infinite: false, value: result.worstCaseBacktrackCount },
  };
}

/**
 * Check if the provided regular expression object is not susceptible to ReDoS attacks.
 *
 * Can be configured with various options in the second argument.
 */
export function isSafe(
  regexp: RegExp,
  config?: IsSafeConfig
): RedosDetectorResult {
  let unicode = false;
  for (const flag of regexp.flags.split('')) {
    if (!supportedJSFlags.has(flag)) {
      throw new Error(`Unsupported flag: ${flag}`);
    }
    if (flag === 'u') {
      unicode = true;
    }
  }

  return isSafePattern(regexp.source, { ...config, unicode });
}
