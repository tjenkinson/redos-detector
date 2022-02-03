/* eslint-disable no-console */
import { defaultMaxSteps, isSafePattern, toFriendly } from './redos-detector';
import { Command } from 'commander';
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
  .option('--unicode', 'enable unicode mode', false)
  .option('--maxResults <number>', 'max number of results to emit', toInt, 1)
  .option(
    '--maxSteps <number>',
    'max number of steps to take',
    toInt,
    defaultMaxSteps
  )
  .option('--timeout <number>', 'timeout in ms', toInt, -1)
  .option('--disableDowngrade', 'do not downgrade the regex if required', false)
  .option(
    '--json',
    'output the result as JSON. Unsafe regex will exit with code 0. Check the `safe` property',
    false
  )
  .action(
    (
      pattern: string,
      {
        disableDowngrade,
        json,
        maxResults,
        maxSteps,
        timeout,
        unicode,
      }: {
        disableDowngrade: boolean;
        json: boolean;
        maxResults?: number;
        maxSteps?: number;
        timeout?: number;
        unicode: boolean;
      }
    ) => {
      try {
        const result = isSafePattern(pattern, {
          downgradePattern: !disableDowngrade,
          maxResults: coerceInfinity(maxResults),
          maxSteps: coerceInfinity(maxSteps),
          timeout: coerceInfinity(timeout),
          unicode,
        });
        if (json) {
          console.log(JSON.stringify(result));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
          process.exit(0);
        } else {
          console.log(toFriendly(result));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
          process.exit(result.safe ? 0 : 1);
        }
      } catch (e) {
        console.error(errorToMessage(e));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
        process.exit(1);
      }
    }
  );

program.parse();
