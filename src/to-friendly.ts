import { RedosDetectorError, RedosDetectorResult } from './redos-detector';

/**
 * Takes a result and converts it to a text representation.
 *
 * Do not try and parse this string programatically. It may change
 * between any version.
 */
export function toFriendly(result: RedosDetectorResult): string {
  if (result.safe) {
    return `Regex is safe.`;
  }

  const outputLines: string[] = [];

  if (result.patternDowngraded) {
    outputLines.push(`Pattern was downgraded to \`${result.pattern}\`.`);
  }

  if (!result.trails.length) {
    const parts: string[] = [];
    parts.push(`Regex may not be safe.`);

    if (result.error === 'timedOut') {
      parts.push(`Timed out.`);
    }
    if (result.error === 'hitMaxSteps') {
      parts.push(`Reached steps limit.`);
    }
    if (result.error === 'stackOverflow') {
      parts.push(`Stack overflow.`);
    }
    parts.push(`The pattern may have too many variations.`);
    outputLines.push(parts.join(' '));
  } else {
    const resultBlocks = result.trails.map(({ trail }) => {
      const rowContents = trail.map(({ a, b }) => {
        return [
          `${a.node.start.offset}`,
          `\`${a.node.source}\``,
          `${b.node.start.offset}`,
          `\`${b.node.source}\``,
        ];
      });

      const maxCol1Length = Math.max(...rowContents.map(([col]) => col.length));
      const maxCol2Length = Math.max(
        ...rowContents.map(([, col]) => col.length)
      );
      const maxCol3Length = Math.max(
        ...rowContents.map(([, , col]) => col.length)
      );

      const rows = rowContents.map(([col1, col2, col3, col4]) => {
        return `${col1.padStart(maxCol1Length)}: ${col2.padEnd(
          maxCol2Length
        )} | ${col3.padStart(maxCol3Length)}: ${col4}`;
      });

      const maxRowLength = Math.max(...rows.map((row) => row.length));

      rows.push('='.repeat(maxRowLength));

      return rows.join('\n');
    });

    const errorToMessage: Record<RedosDetectorError, string> = {
      hitMaxSteps:
        'Hit maximum number of steps so there may be more results than shown here.',
      stackOverflow:
        'Stack overflow occurred. Regex may have too much branching.',
      timedOut: 'Timed out so there may be more results than shown here.',
    };
    const lastLine = result.error ? errorToMessage[result.error] : null;

    outputLines.push(
      ...[
        `Regex is not safe. The following trail${
          result.trails.length > 1 ? 's' : ''
        } show${
          result.trails.length === 1 ? 's' : ''
        } how the same input can be matched multiple ways.`,
        ``,
        ...resultBlocks,
        ...(lastLine ? [lastLine] : []),
        `Note there may be more results than shown here as some infinite loops are detected and removed.`,
      ]
    );
  }

  return outputLines.join('\n');
}
