/* eslint-disable no-console */
import {
  defaultMaxScore,
  defaultMaxSteps,
  isSafePattern,
  toFriendly,
} from './redos-detector';
import { Command } from 'commander';
import { defaultResultsLimit } from './to-friendly';
import description from 'package-json:description';
import version from 'package-json:version';

const program = new Command();

const toInt = (value: string): number => parseInt(value, 10);
const coerceInfinity = (value: number | undefined): number | undefined =>
  value === -1 ? Infinity : value;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorToMessage = (error: any): string => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!error || typeof error !== 'object' || !error.message) {
    return 'Unexpected error';
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return error.message;
};

program
  .description(description)
  .version(version)
  .command('check')
  .argument('<regex pattern>', 'the regex pattern')
  .option('--caseInsensitive', 'enable case insensitive mode', false)
  .option('--unicode', 'enable unicode mode', false)
  .option('--dotAll', 'enable dot-all mode', false)
  .option('--multiLine', 'enable multiline mode', false)
  .option('--maxScore <number>', 'max score to allow', toInt, defaultMaxScore)
  .option(
    '--resultsLimit <number>',
    'the maximum number of results to print, ignored with --json',
    toInt,
    defaultResultsLimit,
  )
  .option(
    '--maxSteps <number>',
    'max number of steps to take',
    toInt,
    defaultMaxSteps,
  )
  .option('--timeout <number>', 'timeout in ms', toInt, -1)
  .option(
    '--alwaysIncludeTrails',
    'always include trails if some are found, even if the patten is considered safe',
    false,
  )
  .option('--disableDowngrade', 'do not downgrade the regex if required', false)
  .option(
    '--json',
    'output the result as JSON. Unsafe regex will exit with code 0. Check the `safe` property',
    false,
  )
  .action(
    (
      pattern: string,
      {
        alwaysIncludeTrails,
        disableDowngrade,
        json,
        maxScore,
        maxSteps,
        resultsLimit,
        timeout,
        caseInsensitive,
        dotAll,
        unicode,
        multiLine,
      }: {
        alwaysIncludeTrails: boolean;
        caseInsensitive: boolean;
        disableDowngrade: boolean;
        dotAll: boolean;
        json: boolean;
        maxScore: number;
        maxSteps: number;
        multiLine: boolean;
        resultsLimit: number;
        timeout: number;
        unicode: boolean;
      },
    ) => {
      try {
        const result = isSafePattern(pattern, {
          caseInsensitive,
          dotAll,
          downgradePattern: !disableDowngrade,
          maxScore: coerceInfinity(maxScore),
          maxSteps: coerceInfinity(maxSteps),
          multiLine,
          timeout: coerceInfinity(timeout),
          unicode,
        });
        if (json) {
          console.log(JSON.stringify(result));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
          process.exit(0);
        } else {
          console.log(
            toFriendly(result, {
              alwaysIncludeTrails,
              resultsLimit: coerceInfinity(resultsLimit),
            }),
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
          process.exit(result.safe ? 0 : 1);
        }
      } catch (e) {
        console.error(errorToMessage(e));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
        process.exit(1);
      }
    },
  );

program.parse();
