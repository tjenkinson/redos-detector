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
  end: number
): string {
  return `${input.slice(0, start)}${replacement}${input.slice(end)}`;
}

function quantifierIterationsToString(
  quantifier: Quantifier<MyFeatures>
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

export function getRawWithoutCapturingGroupsOrLookaheads(
  rootNode: MyRootNode
): { containedReference: boolean; result: string } {
  let containedReference = false;
  const walk = (node: MyRootNode): string => {
    const walkAll = (nodes: MyRootNode[]): string =>
      nodes.map((a) => walk(a)).join('');

    switch (node.type) {
      case 'anchor':
      case 'characterClass':
      case 'characterClassEscape':
      case 'unicodePropertyEscape':
      case 'value':
      case 'dot':
        return node.raw;
      case 'reference': {
        containedReference = true;
        return node.raw;
      }
      case 'group': {
        switch (node.behavior) {
          case 'normal':
          case 'ignore':
            return `(?:${walkAll(node.body)})`;
          case 'lookahead':
          case 'lookbehind':
          case 'negativeLookahead':
          case 'negativeLookbehind':
            return '';
        }
      }
      // eslint-disable-next-line no-fallthrough
      case 'disjunction':
        return node.body.map((a) => walk(a)).join('|');
      case 'alternative':
        return walkAll(node.body);
      case 'quantifier': {
        return `${walk(node.body[0])}${quantifierIterationsToString(node)}`;
      }
    }
  };
  const result = walk(rootNode);
  return { containedReference, result };
}

type Action = Readonly<{
  atomic: boolean;
  group: CapturingGroup<MyFeatures>;
  optional: boolean;
  reference: Reference;
}>;

/**
 * Downgrade the provided pattern if needed so that it is supported
 * for checking.
 *
 * A downgraded pattern may introduce false positives.
 *
 * This does the following:
 * - If the pattern contains a reference to a group that lives in a positive lookahead,
 *   the reference will be replaced with a non-capturing group that contains referenced group.
 * - If the pattern contains a reference to a group that is a non-finite size,
 *   the reference will be replaced with a non-capturing group that contains the referenced group.
 */
export function downgradePattern({
  pattern,
  unicode,
}: DowngradePatternConfig): DowngradedRegexPattern {
  const run = (
    lastResult: DowngradedRegexPattern
  ): { needToRerun: boolean; result: DowngradedRegexPattern } => {
    const ast = parse(lastResult.pattern, unicode);
    const actions: Action[] = [];

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
      group: Group<MyFeatures>
    ): boolean => {
      if (lookahead.body.length !== 1) return false;
      const node = lookahead.body[0];
      return node === group;
    };

    const walkAll = (
      nodes: MyRootNode[],
      nodeStack: readonly MyRootNode[],
      serial: boolean
    ): void => {
      let justHadLookahead: NonCapturingGroup<MyFeatures> | null = null;
      nodes.forEach((expression) => {
        if (serial) {
          // eslint-disable-next-line no-use-before-define
          walk(expression, nodeStack, justHadLookahead);
          justHadLookahead =
            expression.type === 'group' && expression.behavior === 'lookahead'
              ? expression
              : null;
        } else {
          // eslint-disable-next-line no-use-before-define
          walk(expression, nodeStack, null);
        }
      });
    };

    const walk = (
      node: MyRootNode,
      nodeStack: readonly MyRootNode[],
      immediatelyPreceedingLookahead: NonCapturingGroup<MyFeatures> | null
    ): void => {
      switch (node.type) {
        case 'anchor':
        case 'characterClass':
        case 'characterClassEscape':
        case 'unicodePropertyEscape':
        case 'value':
        case 'dot':
          return;
        case 'group': {
          let groupIndex: number | null = null;
          if (node.behavior === 'normal') {
            groupIndex = nextGroupIndex;
            nextGroupIndex++;
          }

          walkAll(node.body, [...nodeStack, node], true);

          if (groupIndex !== null && node.behavior === 'normal') {
            groups.set(groupIndex, { group: node, stack: [...nodeStack] });
          }
          return;
        }
        case 'disjunction': {
          walkAll(node.body, [...nodeStack, node], false);
          return;
        }
        case 'alternative': {
          walkAll(node.body, [...nodeStack, node], true);
          return;
        }
        case 'quantifier': {
          if (node.max === undefined) {
            nodeStack.forEach((stackNode) => {
              if (stackNode.type === 'group') {
                infiniteGroups.add(stackNode);
              }
            });
          }
          walkAll(node.body, [...nodeStack, node], false);
          return;
        }
        case 'reference': {
          const entry = groups.get(node.matchIndex);
          if (entry) {
            const { group, stack } = entry;

            const localStack = dropCommon(stack, nodeStack).a;
            const lookaheadStack = localStack.flatMap((stackNode) =>
              stackNode.type === 'group' &&
              lookaheadBehaviours.indexOf(stackNode.behavior) >= 0
                ? [stackNode]
                : []
            );
            const groupMayNotBeReached = localStack.some(
              (stackNode) =>
                stackNode.type === 'disjunction' ||
                (stackNode.type === 'quantifier' && stackNode.min === 0)
            );

            const groupInLookahead = lookaheadStack.length > 0;
            const groupCouldBeSet = lookaheadStack.every(
              (value) =>
                value.behavior !== 'negativeLookahead' &&
                value.behavior !== 'negativeLookbehind'
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
                !!immediatelyPreceedingLookahead &&
                lookaheadOnlyContainsGroup(
                  immediatelyPreceedingLookahead,
                  group
                );

              actions.push({
                atomic,
                group,
                optional: groupInLookahead && groupMayNotBeReached,
                reference: node,
              });
            }
          }
          return;
        }
      }
    };

    walk(ast, [], null);

    let newPattern = lastResult.pattern;
    let atomicGroupOffsets: Set<number> = new Set(
      lastResult.atomicGroupOffsets
    );
    let needToRerun = false;

    [...actions]
      .sort((a, b) => b.reference.range[0] - a.reference.range[0])
      .forEach((action) => {
        const {
          atomic,
          optional,
          group,
          reference: {
            range: [referenceStart, referenceEnd],
          },
        } = action;

        const { result, containedReference } =
          getRawWithoutCapturingGroupsOrLookaheads(group);

        if (containedReference) {
          needToRerun = true;
        }

        const replacement = optional ? `(?:${result}?)` : result;

        if (atomic) {
          atomicGroupOffsets.add(referenceStart);
        }

        newPattern = replace(
          newPattern,
          replacement,
          referenceStart,
          referenceEnd
        );

        const shiftAmount =
          replacement.length - (referenceEnd - referenceStart);
        atomicGroupOffsets = new Set(
          [...atomicGroupOffsets].map((offset) => {
            return offset > referenceStart ? offset + shiftAmount : offset;
          })
        );
      });

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
      return result;
    }
  }
}
