import {
  AstNode,
  CapturingGroup,
  NonCapturingGroup,
  Reference,
} from 'regjsparser';
import { MyFeatures, MyRootNode } from './parse';

export type NodeExtra = Readonly<{
  capturingGroupToIndex: ReadonlyMap<CapturingGroup<MyFeatures>, number>;
  indexToCapturingGroup: ReadonlyMap<number, CapturingGroup<MyFeatures>>;
  nodeToLookaheadStack: ReadonlyMap<
    CapturingGroup<MyFeatures> | Reference<MyFeatures>,
    readonly NonCapturingGroup<MyFeatures>[]
  >;
}>;

const lookaheadBehaviours: readonly string[] = [
  'lookahead',
  'lookbehind',
  'negativeLookahead',
  'negativeLookbehind',
];

export function buildNodeExtra(regexp: MyRootNode): NodeExtra {
  const capturingGroupToIndex = new Map<CapturingGroup<MyFeatures>, number>();
  const indexToCapturingGroup = new Map<number, CapturingGroup<MyFeatures>>();
  const nodeToLookaheadStack = new Map<
    CapturingGroup<MyFeatures> | Reference<MyFeatures>,
    readonly NonCapturingGroup<MyFeatures>[]
  >();

  const visit = (
    node: AstNode<MyFeatures>,
    lookaheadStack: readonly NonCapturingGroup<MyFeatures>[],
  ): void => {
    switch (node.type) {
      case 'anchor':
      case 'characterClass':
      case 'characterClassEscape':
      case 'characterClassRange':
      case 'unicodePropertyEscape':
      case 'value':
      case 'dot':
        return;
      case 'reference': {
        nodeToLookaheadStack.set(node, lookaheadStack);
        break;
      }
      case 'alternative':
      case 'disjunction': {
        node.body.forEach((expression) => visit(expression, lookaheadStack));
        return;
      }
      case 'group': {
        if (node.behavior === 'normal') {
          const index = capturingGroupToIndex.size + 1;
          capturingGroupToIndex.set(node, index);
          indexToCapturingGroup.set(index, node);
          nodeToLookaheadStack.set(node, lookaheadStack);
        }

        const newLookaheadStack = [...lookaheadStack];
        if (
          node.behavior !== 'normal' &&
          lookaheadBehaviours.indexOf(node.behavior) >= 0
        ) {
          newLookaheadStack.push(node);
        }

        node.body.forEach((expression) => visit(expression, newLookaheadStack));
        return;
      }
      case 'quantifier': {
        node.body.forEach((expression) => visit(expression, lookaheadStack));
        return;
      }
    }
  };

  visit(regexp, []);

  return {
    capturingGroupToIndex,
    indexToCapturingGroup,
    nodeToLookaheadStack,
  };
}
