import {
  downgradePattern as downgradePatternFn,
  isMissingStartAnchor,
} from './downgrade-pattern';
import { MyFeatures, parse } from './parse';
// eslint-disable-next-line @typescript-eslint/naming-convention
import _version from 'package-json:version';
import { AstNode } from 'regjsparser';
import { CharacterReaderLevel2Stack } from './character-reader/character-reader-level-2';
import { collectResults } from './collect-results';

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
  readonly maxScore?: number;
  /**
   * The maximum number of steps to make. If this limit is hit `error`
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
       * It exists because sometimes when a pattern is downgraded, some of
       * the groups in the downgrade can be considered atomic.
       */
      readonly atomicGroupOffsets?: ReadonlySet<number>;
      /**
       * Do not downgrade the pattern if it's not supported as is.
       *
       * An exception may be thrown if the pattern needed to be downgraded.
       */
      readonly downgradePattern: false;
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
      readonly downgradePattern?: true;
    }
);

export type RedosDetectorError = 'hitMaxScore' | 'hitMaxSteps' | 'timedOut';

export type Score = { infinite: false; value: number } | { infinite: true };

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
   * The score.
   *
   * How is this calculated?
   * - All the different paths an input string could take through the provided pattern are calculated.
   * - Then for each candidate path found above, starting from just the first character, up to the complete path,
   *   all the other paths that could also match a string that matches the candidate path are found.
   * - The score is the highest number found above. The higher the score, the more backtracks an engine will
   *   potentially need to take if the input string doesn't match the pattern.
   * - If the score is `1` this means no backtracks can occur and for every possible input string the pattern
   *   could only match one way.
   * - If there are too many different paths it can be too expensive to calculate an accurate score,
   *   so it falls back incrementing every time a new path is found.
   *
   * If it's infinite the `infinite` property will be `true`, otherwise the number
   * will be on `value`.
   */
  readonly score: Score;
} & (
  | {
      /**
       * `null` means no error occurred.
       */
      readonly error: null;
      /**
       * `true` means the regex pattern is not susceptible to ReDoS attacks
       * based on the configured `maxScore` option.
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
   * Enable case insensitive mode.
   */
  readonly caseInsensitive?: boolean;
  /**
   * Enable dot-all mode, which allows `.` to match new lines.
   */
  readonly dotAll?: boolean;
  /**
   * Enable multi-line mode which changes `^` and `$` to
   * match the start or end of any line within the string.
   */
  readonly multiLine?: boolean;
  /**
   * Enable unicode mode.
   */
  readonly unicode?: boolean;
};

export const defaultTimeout = Infinity;
export const defaultMaxScore = 200;
export const defaultMaxSteps = 20000;
export const defaultMultiLine = false;
export const defaultUnicode = false;
export const defaultCaseInsensitive = false;
export const defaultDotAll = false;
const supportedJSFlags: ReadonlySet<string> = new Set([
  'u',
  'g',
  's',
  'y',
  'i',
  'd',
  'm',
]);

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
  stack: CharacterReaderLevel2Stack,
): RedosDetectorBackReferenceStack {
  return stack
    .flatMap((stackEntry) =>
      stackEntry.type === 'reference' ? [stackEntry.reference] : [],
    )
    .reverse()
    .map((reference) => {
      return {
        index: reference.matchIndex,
        node: toRedosDetectorNode(reference),
      };
    });
}

function toRedosDetectorQuantifierIterations(
  stack: CharacterReaderLevel2Stack,
): RedosDetectorQuantifierIterations {
  const reversedStack = [...stack].reverse();
  const referenceStackIndex = reversedStack.findIndex(
    ({ type }) => type === 'reference',
  );
  const noneReferenceStackPortion = reversedStack
    .slice(0, referenceStackIndex >= 0 ? referenceStackIndex : stack.length)
    .reverse();

  return noneReferenceStackPortion
    .flatMap((entry) => (entry.type === 'quantifier' ? [entry] : []))
    .map(({ quantifier, iteration }) => {
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
    maxScore = defaultMaxScore,
    maxSteps = defaultMaxSteps,
    multiLine = defaultMultiLine,
    timeout = defaultTimeout,
    caseInsensitive = defaultCaseInsensitive,
    dotAll = defaultDotAll,
    unicode = defaultUnicode,
    downgradePattern = true,
  }: IsSafePatternConfig = {},
): RedosDetectorResult {
  if (caseInsensitive && unicode) {
    // https://mathiasbynens.be/notes/es6-unicode-regex
    throw new Error('`caseInsensitive` cannot be used with `unicode`.');
  }
  if (downgradePattern && atomicGroupOffsetsInput) {
    throw new Error(
      '`atomicGroupOffsets` cannot be used with `downgradePattern: true`.',
    );
  }
  if (timeout <= 0) {
    throw new Error('`timeout` must be a positive number.');
  }
  if (maxScore < 0) {
    throw new Error('`maxScore` must be a positive number or 0.');
  }
  if (maxSteps <= 0) {
    throw new Error('`maxSteps` must be a positive number.');
  }

  const { pattern, atomicGroupOffsets }: PatternWithAtomicGroupOffsets =
    downgradePattern
      ? downgradePatternFn({ pattern: inputPattern, unicode })
      : {
          atomicGroupOffsets: new Set(atomicGroupOffsetsInput || []),
          pattern: inputPattern,
        };

  const patternDowngraded = downgradePattern && inputPattern !== pattern;

  const ast = parse(pattern, unicode);
  if (!downgradePattern && isMissingStartAnchor(ast)) {
    throw new Error(
      'Pattern is not bounded at the start and needs downgrading. See the `downgradePattern` option.',
    );
  }

  const result = collectResults({
    atomicGroupOffsets,
    caseInsensitive,
    dotAll,
    maxScore,
    maxSteps,
    multiLine,
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
    score:
      result.score === Infinity
        ? { infinite: true }
        : { infinite: false, value: result.score },
    trails: result.trails.map((trail) => {
      const safeRegexTrail: RedosDetectorTrail = {
        trail: trail.map(({ left, right }) => {
          const entry: RedosDetectorTrailEntry = {
            a: {
              backreferenceStack: toRedosDetectorBackReferenceStack(
                right.stack,
              ),
              node: toRedosDetectorNode(right.node),
              quantifierIterations: toRedosDetectorQuantifierIterations(
                right.stack,
              ),
            },
            b: {
              backreferenceStack: toRedosDetectorBackReferenceStack(left.stack),
              node: toRedosDetectorNode(left.node),
              quantifierIterations: toRedosDetectorQuantifierIterations(
                left.stack,
              ),
            },
          };
          return entry;
        }),
      };
      return safeRegexTrail;
    }),
  };
}

/**
 * Check if the provided regular expression object is not susceptible to ReDoS attacks.
 *
 * Can be configured with various options in the second argument.
 */
export function isSafe(
  regexp: RegExp,
  config?: IsSafeConfig,
): RedosDetectorResult {
  let unicode = false;
  let caseInsensitive = false;
  let dotAll = false;
  let multiLine = false;
  for (const flag of regexp.flags.split('')) {
    if (!supportedJSFlags.has(flag)) {
      throw new Error(`Unsupported flag: ${flag}`);
    }
    if (flag === 'u') unicode = true;
    if (flag === 'i') caseInsensitive = true;
    if (flag === 's') dotAll = true;
    if (flag === 'm') multiLine = true;
  }

  return isSafePattern(regexp.source, {
    ...config,
    caseInsensitive,
    dotAll,
    multiLine,
    unicode,
  });
}
