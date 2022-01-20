import { parse as libParse, RootNode } from 'regjsparser';

export type MyFeatures = { unicodePropertyEscape: true };
export type MyRootNode = RootNode<MyFeatures>;

export function parse(pattern: string, unicode: boolean): MyRootNode {
  const ast = libParse(pattern, unicode ? 'u' : '', {
    lookbehind: true,
    unicodePropertyEscape: true,
  });
  return ast;
}
