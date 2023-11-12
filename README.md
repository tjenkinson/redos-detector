# redos-detector

A CLI and library which tests with certainty if a regex pattern is safe from ReDoS attacks. Supported in the browser, Node and Deno.

By default it considers a pattern unsafe if there are potentially more than 200 backtracks possible.

There are some cases where it may report a pattern as unsafe when in reality it's safe, but it should never report a pattern as safe when it is not.

Note that this tool checks patterns that are expected to run using an engine that implements the [ECMA-262](https://www.ecma-international.org/publications-and-standards/standards/ecma-262/) (JS) standard. If your pattern will be run in a different engine please be aware the result given here could be incorrect due to [differences in engine behaviour](docs/differences-in-engines.md).

## Demo

[https://redosdetector.com/](https://redosdetector.com/) [[Source](https://github.com/tjenkinson/redos-detector-demo)]

## Examples

### Good

```ts
isSafe(/^([a-c]*)d([a-c]*)$/).safe === true;
```

[Demo](https://redosdetector.com/?pattern=%5E%28%5Ba-c%5D*%29d%28%5Ba-c%5D*%29%24)

because for any given input string this can only match in one way, or not match.

### Bad

```ts
isSafe(/^([a-b]*)([a-c]*)$/).safe === false;
```

[Demo](https://redosdetector.com/?pattern=%5E%28%5Ba-b%5D*%29%28%5Ba-c%5D*%29%24)

because the input `a` could match in both places. The input `ax` could result in both being tried.

The CLI would output the following for this:

```
Regex is not safe. There could be infinite backtracks.

The following trails show how the same input can be matched multiple ways.
2: `[a-b]` | 10: `[a-c]`
========================
 2: `[a-b]` | 10: `[a-c]`
10: `[a-c]` | 10: `[a-c]`
=========================
 2: `[a-b]` | 10: `[a-c]`
10: `[a-c]` | 10: `[a-c]`
10: `[a-c]` | 10: `[a-c]`
=========================
2: `[a-b]` | 10: `[a-c]`
2: `[a-b]` | 10: `[a-c]`
========================

Hit maximum number of backtracks so there may be more results than shown here.
Note there may be more results than shown here as some infinite loops are detected and removed.
```

The first result means you could have a match where given the same input string, `[a-c]` takes a character (at position 10), or `[a-b]` takes a character (at position 2).

_Note this could be made good again by making the first group atomic. [Atomic groups](https://www.regular-expressions.info/atomic.html) are not supported directly right now, but can be inferred using a pattern like `^(?=([a-b]*))\1([a-c]*)$` ([Demo](https://redosdetector.com/?pattern=%5E%28%3F%3D%28%5Ba-b%5D*%29%29%5C1%28%5Ba-c%5D*%29%24))._

```ts
isSafe(/^(a|a)+$/).safe === false;
```

[Demo](https://redosdetector.com/?pattern=%5E%28a%7Ca%29%2B%24)

is bad because in the group `a` could match on both sides. The input `aaaaaax` could result in many combinations being tried.

## How does it work?

This tool will generate all the combinations of input strings that would match the pattern, and will output any input string that could match the pattern in multiple ways.

## Usage

This can be used via the CLI, or as a library. It's [on npm](https://www.npmjs.com/package/redos-detector).

There's also an ESLint plugin "[eslint-plugin-redos-detector](https://github.com/tjenkinson/eslint-plugin-redos-detector)".

### Result Structure

The following is the structure of the result you will get from both `isSafe`, `isSafePattern` and the CLI with the `--json` flag.

#### Root

```ts
type Root = {
  safe: boolean;
  error: null | 'hitMaxBacktracks' | 'hitMaxSteps' | 'timedOut';
  trails: Trail[];
  patternDowngraded: boolean;
  pattern: string;
  worstCaseBacktrackCount:
    | {
        infinite: true;
      }
    | {
        infinite: false;
        value: number;
      };
};
```

#### Trail

```ts
type Trail = {
  trail: {
    a: Side;
    b: Side;
  }[];
};
```

#### Side

```ts
type Side = {
  backreferenceStack: {
    index: number;
    node: Node;
  }[];
  node: Node;
  quantifierIterations: {
    iteration: number;
    node: Node;
  }[];
};
```

#### Node

```ts
type Node = {
  start: Location;
  end: Location;
  source: string;
};
```

#### Location

```ts
type Location = {
  offset: number;
};
```

### Options

The following options exist for both the library and CLI:

- `caseInsensitive`: Enable case insensitive mode. _(Default: `false`)_
- `unicode`: Enable unicode mode. _(Default: `false`)_
- `dotAll`: Enable dot-all mode, which allows `.` to match new lines. _(Default: `false`)_
- `multiLine`: Enable multi-line mode, which changes `^` and `$` to match the start or end of any line within the string. _(Default: `false`)_
- `maxBacktracks`: If worst case count of possible backtracks is above this number, the regex will be considered unsafe. _(Default: `200`)_
- `maxSteps`: The maximum number of steps to make. If this limit is hit `error` will be `hitMaxSteps`. You probably don't need to change this. _(Default: `20000`)_
- `timeout`: The maximum amount of time (ms) to spend processing. Once this time is passed the trails found so far will be returned, and the `error` will be `timeout`. _(Default: `Infinity`)_
- `downgradePattern`: Automatically downgrade the pattern if it's not supported as is. If this happens `patternDowngraded` will be `true` and `pattern` will contain the downgraded version. An exception may be thrown if the pattern needed to be downgraded and it wasn't. _(Default: `true`)_

_Note it's possible for there to be a infinite number of results, so you should probably make sure at least one of the `maxSteps` and `timeout` options is set to a finite number._

### CLI

```sh
$ npx redos-detector check "<regex pattern>" (--caseInsensitive) (--unicode) (--dotAll) (--multiLine) (--maxBacktracks <number>) (--maxSteps <number>) (--timeout <number>) (--alwaysIncludeTrails) (--disableDowngrade) (--resultsLimit <number>) (--json)
```

to run on the fly or

```sh
$ npm i -g redos-detector
```

to make the command available globally as `redos-detector`.

By default this will output the result in a text format, and the exit status will be `0` if the pattern is safe, otherwise non-`0`. You should not try and parse this text output as it may change between any version.

Only the first 15 results will be shown in the text output, but this can be changed with the `--resultsLimit` option. This option is ignored with `--json`.

The `--json` option will result in JSON being outputted containing more information. The structure of this will follow semantic versioning. When this option is used the exit status will always be `0` (unless an exception occurred), so you should always check the `safe` property to determine if the pattern is safe.

### Library

```sh
$ npm install redos-detector
```

The following functions are provided:

- `isSafe(regexp: RegExp, options?: { maxBacktracks?: number, maxSteps?: number, timeout?: number, downgradePattern?: boolean })`: This takes a [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp). The `i` and `u` flags are supported.
- `isSafePattern(pattern: string, options?: { maxBacktracks?: number, maxSteps?: number, timeout?: number, downgradePattern?: boolean, caseInsensitive?: boolean, unicode?: boolean, dotAll?: boolean, multiLine?: boolean })`: This takes just the pattern as a string. E.g. `a*`.
- `downgradePattern(input: { pattern: string, unicode: boolean }`: This downgrades the provided pattern to one which is supported. You won't need to use this unless you set the `downgradePattern` option to `false`.

## Useful Resources

Here are some great resources, which I found super helpful when building this.

- **[https://www.regular-expressions.info/](https://www.regular-expressions.info/)**: Site containing everything you'd want to know about Regular Expressions.
- **[https://regexper.com/](https://regexper.com/)**: Tool for visualising a regex pattern as a chart.
- **[https://regex101.com/](https://regex101.com/)**: Tool for testing a pattern with syntax highlighting and useful information.
- **[https://github.com/jviereck/regjsparser](https://github.com/jviereck/regjsparser)**: Parser used by this project.
