import {
  RedosDetectorError,
  RedosDetectorResult,
  RedosDetectorTrailEntrySide,
} from './redos-detector';

export type ToFriendlyConfig = {
  alwaysIncludeTrails?: boolean;
  resultsLimit?: number;
};

export const defaultResultsLimit = 15;

function getBreadcrumbs(side: RedosDetectorTrailEntrySide): string {
  return `${[
    ...side.backreferenceStack.map(({ node }) => node.start.offset).reverse(),
    side.node.start.offset,
  ].join(`→`)}`;
}

/**
 * Takes a result and converts it to a text representation.
 *
 * Do not try and parse this string programatically. It may change
 * between any version.
 */
export function toFriendly(
  result: RedosDetectorResult,
  {
    resultsLimit = defaultResultsLimit,
    alwaysIncludeTrails = false,
  }: ToFriendlyConfig = {},
): string {
  if (resultsLimit < 0) {
    throw new Error('`resultsLimit` must be > 0.');
  }
  const backtrackCountString =
    result.worstCaseBacktrackCount.infinite ||
    result.worstCaseBacktrackCount.value > 0
      ? `There could be ${
          !result.worstCaseBacktrackCount.infinite ? 'at most ' : ''
        }${
          result.worstCaseBacktrackCount.infinite
            ? 'infinite backtracks'
            : result.worstCaseBacktrackCount.value === 1
            ? '1 backtrack'
            : `${result.worstCaseBacktrackCount.value} backtracks`
        }.`
      : null;

  if (result.safe && !alwaysIncludeTrails) {
    return `Regex is safe.${
      backtrackCountString ? ` ${backtrackCountString}` : ''
    }`;
  }

  const outputLines: string[] = [];

  if (result.patternDowngraded) {
    outputLines.push(`Pattern was downgraded to \`${result.pattern}\`.`);
  }

  if (!result.trails.length) {
    const parts: string[] = [];
    parts.push(result.safe ? 'Regex is safe.' : 'Regex may not be safe.');

    if (result.error === 'timedOut') {
      parts.push(`Timed out.`);
    }
    if (result.error === 'hitMaxSteps') {
      parts.push(`Reached steps limit.`);
    }
    if (!result.safe) {
      parts.push(`The pattern may have too many variations.`);
    }
    outputLines.push(parts.join(' '));
  } else {
    const resultBlocks = result.trails
      .slice(0, resultsLimit)
      .map(({ trail }) => {
        const rowContents = trail.map(({ a, b }) => {
          return [
            getBreadcrumbs(a),
            `\`${a.node.source}\``,
            getBreadcrumbs(b),
            `\`${b.node.source}\``,
          ];
        });

        const maxCol1Length = Math.max(
          ...rowContents.map(([col]) => col.length),
        );
        const maxCol2Length = Math.max(
          ...rowContents.map(([, col]) => col.length),
        );
        const maxCol3Length = Math.max(
          ...rowContents.map(([, , col]) => col.length),
        );

        const rows = rowContents.map(([col1, col2, col3, col4]) => {
          return `${col1.padStart(maxCol1Length)}: ${col2.padEnd(
            maxCol2Length,
          )} | ${col3.padStart(maxCol3Length)}: ${col4}`;
        });

        const maxRowLength = Math.max(...rows.map((row) => row.length));

        rows.push('='.repeat(maxRowLength));

        return rows.join('\n');
      });

    const errorToMessage: Record<RedosDetectorError, string> = {
      hitMaxBacktracks:
        'Hit maximum number of backtracks so there may be more results than shown here.',
      hitMaxSteps:
        'Hit maximum number of steps so there may be more results than shown here.',
      timedOut: 'Timed out so there may be more results than shown here.',
    };

    outputLines.push(
      ...[
        `Regex is ${!result.safe ? 'not ' : ''}safe.${
          backtrackCountString ? ` ${backtrackCountString}` : ''
        }`,
        ...(resultsLimit > 0
          ? [
              '',
              `The following trail${result.trails.length > 1 ? 's' : ''} show${
                result.trails.length === 1 ? 's' : ''
              } how the same input can be matched multiple ways.`,
              ...resultBlocks,
              '',
              ...(result.error ? [errorToMessage[result.error]] : []),
              `Note there may be more results than shown here as some infinite loops are detected and removed.`,
              ...(result.trails.length > resultsLimit
                ? ['There are more results than this but hit results limit.']
                : []),
            ]
          : []),
      ],
    );
  }

  return outputLines.join('\n');
}
