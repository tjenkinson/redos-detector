import {
  CapturingGroup,
  Group,
  NonCapturingGroup,
  Quantifier,
  Reference,
} from 'regjsparser';
import { MyFeatures, MyRootNode, parse } from './parse';
import { dropCommon } from './arrays';

export type DowngradePatternConfig = Readonly<{
  /**
   * The regex pattern.
   */
  pattern: string;
  /**
   * Set to `true` to enable unicode mode.
   */
  unicode: boolean;
}>;

export type DowngradedRegexPattern = Readonly<{
  /**
   * Offsets to groups which should be considered atomic.
   *
   * E.g. `(?=(a))\1` => `(?=(a))(?:a)` with atomic group offset 7.
   */
  atomicGroupOffsets: ReadonlySet<number>;
  /**
   * The downgraded pattern.
   */
  pattern: string;
}>;

const lookaheadBehaviours: readonly string[] = [
  'lookahead',
  'lookbehind',
  'negativeLookahead',
  'negativeLookbehind',
];

function replace(
  input: string,
  replacement: string,
  start: number,
  end: number,
): string {
  return `${input.slice(0, start)}${replacement}${input.slice(end)}`;
}

function shiftOffsets({
  after,
  offsets,
  shiftAmount,
}: {
  after: number;
  offsets: ReadonlySet<number>;
  shiftAmount: number;
}): Set<number> {
  return new Set(
    [...offsets].map((offset) => {
      return offset > after ? offset + shiftAmount : offset;
    }),
  );
}

function quantifierIterationsToString(
  quantifier: Quantifier<MyFeatures>,
): string {
  if (quantifier.symbol) {
    return `${quantifier.symbol}${quantifier.greedy ? '' : '?'}`;
  }
  if (quantifier.min === quantifier.max) {
    return `{${quantifier.min}}`;
  }
  return `{${quantifier.min},${quantifier.max || ''}}${
    quantifier.greedy ? '' : '?'
  }`;
}

export type RawWithoutCapturingGroupsOrLookaheads = Readonly<{
  referencesWithOffset: ReadonlyMap<Reference<MyFeatures>, number>;
  result: string;
}>;

function alreadyHasStartAnchorReplacement(node: MyRootNode): boolean {
  if (node.type !== 'alternative') return false;

  const body = node.body;
  /* istanbul ignore next */
  if (body.length < 1) return false;
  const [maybeQuantifier] = body;
  if (maybeQuantifier.type !== 'quantifier') return false;
  if (maybeQuantifier.min !== 0) return false;
  if (maybeQuantifier.max !== undefined) return false;
  if (maybeQuantifier.greedy) return false;
  const maybeCharacterClass = maybeQuantifier.body[0];
  if (maybeCharacterClass.type !== 'characterClass') return false;
  maybeCharacterClass.kind satisfies 'union';
  if (maybeCharacterClass.body.length !== 0) return false;
  if (!maybeCharacterClass.negative) return false;
  return true;
}

export function isMissingStartAnchor(rootNode: MyRootNode): boolean {
  if (alreadyHasStartAnchorReplacement(rootNode)) return false;

  const check = (node: MyRootNode): 'anchor' | 'consumingNode' | null => {
    if (node.type === 'anchor') {
      if (node.kind === 'start') return 'anchor';
      return null;
    }
    if (node.type === 'quantifier' && node.max === 0) return null;
    if (
      node.type === 'alternative' ||
      node.type === 'group' ||
      node.type === 'quantifier'
    ) {
      const mayBeSkipped = node.type === 'quantifier' && node.min === 0;
      for (const child of node.body) {
        const res = check(child);
        if (res === 'consumingNode') return 'consumingNode';
        if (res === 'anchor') {
          if (!mayBeSkipped) return 'anchor';
          return null;
        }
      }
      return null;
    }
    if (node.type === 'disjunction') {
      const res = node.body.map((child) => check(child));
      if (res.some((a) => a === 'consumingNode')) return 'consumingNode';
      if (res.every((a) => a === 'anchor')) return 'anchor';
      return null;
    }
    return 'consumingNode';
  };

  return check(rootNode) === 'consumingNode';
}

export function getRawWithoutCapturingGroupsOrLookaheads(
  rootNode: MyRootNode,
): RawWithoutCapturingGroupsOrLookaheads {
  const referencesWithOffset = new Map<Reference<MyFeatures>, number>();

  const walk = (node: MyRootNode, offset: number): string => {
    const walkAll = (nodes: MyRootNode[], startOffset: number): string => {
      let result = '';
      nodes.forEach((a) => {
        result += walk(a, startOffset + result.length);
      });
      return result;
    };

    switch (node.type) {
      case 'anchor':
      case 'characterClass':
      case 'characterClassEscape':
      case 'unicodePropertyEscape':
      case 'value':
      case 'dot':
        return node.raw;
      case 'reference': {
        referencesWithOffset.set(node, offset);
        return node.raw;
      }
      case 'group': {
        switch (node.behavior) {
          case 'normal':
            return `(?:${walkAll(node.body, offset + 3)})`;
          case 'ignore':
            return `(?:${walkAll(node.body, offset + 3)})`;
          case 'lookahead':
          case 'lookbehind':
          case 'negativeLookahead':
          case 'negativeLookbehind':
            return '';
        }
      }
      // eslint-disable-next-line no-fallthrough
      case 'disjunction': {
        let res = '';
        node.body.forEach((a, i) => {
          if (i > 0) res += '|';
          res += walk(a, offset + res.length);
        });
        return res;
      }
      case 'alternative':
        return walkAll(node.body, offset);
      case 'quantifier': {
        return `${walk(node.body[0], offset)}${quantifierIterationsToString(
          node,
        )}`;
      }
    }
  };
  const result = walk(rootNode, 0);
  return {
    referencesWithOffset,
    result,
  };
}

type Action = Readonly<{
  // it's impossible for it to be both
  atomicOrOptional: 'atomic' | 'optional' | null;
  group: CapturingGroup<MyFeatures>;
  reference: Reference;
}>;

/**
 * Downgrade the provided pattern if needed so that it is supported for checking.
 *
 * A downgraded pattern may introduce false positives.
 *
 * This does the following:
 * - If the pattern contains a reference to a group that lives in a positive lookahead,
 *   the reference will be replaced with a non-capturing group that contains referenced group.
 * - If the pattern contains a reference to a group that is a non-finite size,
 *   the reference will be replaced with a non-capturing group that contains the referenced group.
 * - If the pattern does not contain a start anchor then `[^]*` will be prepended, and the remainder
 *   wrapped in a none capturing group if needed.
 */
export function downgradePattern({
  pattern,
  unicode,
}: DowngradePatternConfig): DowngradedRegexPattern {
  const run = (
    lastResult: DowngradedRegexPattern,
  ): { needToRerun: boolean; result: DowngradedRegexPattern } => {
    const ast = parse(lastResult.pattern, unicode);
    const actions: Action[] = [];

    let needsStartAnchorReplacement = false as boolean;
    const needsWrappingInGroup = ast.type === 'disjunction';

    const groups: Map<
      number,
      {
        group: CapturingGroup<MyFeatures>;
        stack: readonly MyRootNode[];
      }
    > = new Map();
    const infiniteGroups: Set<Group<MyFeatures>> = new Set();
    let nextGroupIndex = 1;

    const lookaheadOnlyContainsGroup = (
      lookahead: NonCapturingGroup<MyFeatures>,
      group: Group<MyFeatures>,
    ): boolean => {
      if (lookahead.body.length !== 1) return false;
      const node = lookahead.body[0];
      return node === group;
    };

    const walkAll = ({
      nodeStack,
      nodes,
      passedStartAnchor,
      serial,
    }: {
      nodeStack: readonly MyRootNode[];
      nodes: MyRootNode[];
      passedStartAnchor: { value: boolean };
      serial: boolean;
    }): void => {
      let justHadLookahead: NonCapturingGroup<MyFeatures> | null = null;
      nodes.forEach((expression) => {
        if (serial) {
          // eslint-disable-next-line no-use-before-define
          walk({
            immediatelyPrecedingLookahead: justHadLookahead,
            node: expression,
            nodeStack,
            passedStartAnchor,
          });
          justHadLookahead =
            expression.type === 'group' && expression.behavior === 'lookahead'
              ? expression
              : null;
        } else {
          // eslint-disable-next-line no-use-before-define
          walk({
            immediatelyPrecedingLookahead: justHadLookahead,
            node: expression,
            nodeStack,
            passedStartAnchor: { ...passedStartAnchor },
          });
        }
      });
    };

    const walk = ({
      immediatelyPrecedingLookahead,
      node,
      nodeStack,
      passedStartAnchor,
    }: {
      immediatelyPrecedingLookahead: NonCapturingGroup<MyFeatures> | null;
      node: MyRootNode;
      nodeStack: readonly MyRootNode[];
      passedStartAnchor: { value: boolean };
    }): void => {
      const onConsumingNode = (): void => {
        if (!passedStartAnchor.value) {
          needsStartAnchorReplacement = true;
        }
      };

      switch (node.type) {
        case 'characterClass':
        case 'characterClassEscape':
        case 'unicodePropertyEscape':
        case 'value':
        case 'dot':
          onConsumingNode();
          return;
        case 'anchor': {
          if (node.kind === 'start') {
            passedStartAnchor.value = true;
          }
          return;
        }
        case 'group': {
          let groupIndex: number | null = null;
          if (node.behavior === 'normal') {
            groupIndex = nextGroupIndex;
            nextGroupIndex++;
          }

          walkAll({
            nodeStack: [...nodeStack, node],
            nodes: node.body,
            passedStartAnchor,
            serial: true,
          });

          if (groupIndex !== null && node.behavior === 'normal') {
            groups.set(groupIndex, { group: node, stack: [...nodeStack] });
          }
          return;
        }
        case 'disjunction': {
          walkAll({
            nodeStack: [...nodeStack, node],
            nodes: node.body,
            passedStartAnchor,
            serial: false,
          });
          return;
        }
        case 'alternative': {
          walkAll({
            nodeStack: [...nodeStack, node],
            nodes: node.body,
            passedStartAnchor,
            serial: true,
          });
          return;
        }
        case 'quantifier': {
          if (node.max !== 0) {
            if (node.max === undefined) {
              [...nodeStack].reverse().some((stackNode) => {
                if (stackNode.type === 'group') {
                  if (lookaheadBehaviours.indexOf(stackNode.behavior) >= 0) {
                    // this infinite quantifier is contained in a lookahead,
                    // so doesn't effect outer group size
                    return true;
                  }
                  infiniteGroups.add(stackNode);
                }
                return false;
              });
            }
            walkAll({
              nodeStack: [...nodeStack, node],
              nodes: node.body,
              passedStartAnchor:
                node.min === 0 ? { ...passedStartAnchor } : passedStartAnchor,
              serial: true,
            });
          }
          return;
        }
        case 'reference': {
          onConsumingNode();
          const entry = groups.get(node.matchIndex);
          if (entry) {
            const { group, stack } = entry;

            const localStack = dropCommon(stack, nodeStack).a;
            const lookaheadStack = localStack.flatMap((stackNode) =>
              stackNode.type === 'group' &&
              lookaheadBehaviours.indexOf(stackNode.behavior) >= 0
                ? [stackNode]
                : [],
            );
            const groupMayNotBeReached = localStack.some(
              (stackNode) =>
                stackNode.type === 'disjunction' ||
                (stackNode.type === 'quantifier' && stackNode.min === 0),
            );

            const groupInLookahead = lookaheadStack.length > 0;
            const groupCouldBeSet = lookaheadStack.every(
              (value) =>
                value.behavior !== 'negativeLookahead' &&
                value.behavior !== 'negativeLookbehind',
            );

            if (
              groupCouldBeSet &&
              (groupInLookahead || infiniteGroups.has(group))
            ) {
              // if we have something like `a(?=(bc))\1`
              // `\1`, and therefore the group we inline in its place, can be considered atomic
              // given that lookaheads can't be backtracked into and immediately after the
              // lookahead we match the same that was in the lookahead
              const atomic =
                !!immediatelyPrecedingLookahead &&
                lookaheadOnlyContainsGroup(
                  immediatelyPrecedingLookahead,
                  group,
                );

              const optional = groupInLookahead && groupMayNotBeReached;

              actions.push({
                atomicOrOptional: atomic
                  ? 'atomic'
                  : optional
                    ? 'optional'
                    : null,
                group,
                reference: node,
              });
            }
          }
          return;
        }
      }
    };

    walk({
      immediatelyPrecedingLookahead: null,
      node: ast,
      nodeStack: [],
      passedStartAnchor: { value: false },
    });

    let newPattern = lastResult.pattern;
    let atomicGroupOffsets: Set<number> = new Set(
      lastResult.atomicGroupOffsets,
    );
    let needToRerun = false;

    [...actions]
      .sort((a, b) => b.reference.range[0] - a.reference.range[0])
      .forEach((action) => {
        const {
          atomicOrOptional,
          group,
          reference: {
            range: [referenceStart, referenceEnd],
          },
        } = action;

        const { result, referencesWithOffset } =
          getRawWithoutCapturingGroupsOrLookaheads(group);

        if (referencesWithOffset.size > 0) {
          needToRerun = true;
        }

        const replacement =
          atomicOrOptional === 'optional' ? `(?:${result}?)` : result;

        newPattern = replace(
          newPattern,
          replacement,
          referenceStart,
          referenceEnd,
        );

        const shiftAmount =
          replacement.length - (referenceEnd - referenceStart);
        atomicGroupOffsets = shiftOffsets({
          after: referenceStart,
          offsets: atomicGroupOffsets,
          shiftAmount,
        });

        if (atomicOrOptional === 'atomic') {
          atomicGroupOffsets.add(referenceStart);
        }

        actions.forEach(
          ({
            atomicOrOptional: innerAtomicOrOptional,
            reference: innerReference,
          }) => {
            if (innerAtomicOrOptional === 'atomic') {
              const offset = referencesWithOffset.get(innerReference);
              if (offset !== undefined) {
                atomicGroupOffsets.add(referenceStart + offset);
              }
            }
          },
        );
      });

    if (needsStartAnchorReplacement && !alreadyHasStartAnchorReplacement(ast)) {
      if (needsWrappingInGroup) {
        newPattern = `(?:${newPattern})`;
      }
      newPattern = `[^]*?${newPattern}`;
      atomicGroupOffsets = shiftOffsets({
        after: -1,
        offsets: atomicGroupOffsets,
        shiftAmount: needsWrappingInGroup ? 8 : 5,
      });
    }

    return { needToRerun, result: { atomicGroupOffsets, pattern: newPattern } };
  };

  let lastResult: DowngradedRegexPattern = {
    atomicGroupOffsets: new Set(),
    pattern,
  };
  for (;;) {
    const { result, needToRerun } = run(lastResult);
    lastResult = result;
    if (!needToRerun) {
      break;
    }
  }
  return lastResult;
}
