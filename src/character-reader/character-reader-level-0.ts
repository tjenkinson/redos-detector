import {
  buildGroupCharacterReader,
  Groups,
  LookaheadStack,
} from '../nodes/group';
import {
  buildQuantifierCharacterReader,
  QuantifierStack,
} from '../nodes/quantifier';
import {
  CharacterClass,
  CharacterClassEscape,
  Dot,
  Reference,
  UnicodePropertyEscape,
  Value,
} from 'regjsparser';
import { buildAnchorReader } from '../nodes/anchor';
import { buildCharacterClassCharacterReader } from '../nodes/character-class';
import { buildCharacterClassEscapeReader } from '../nodes/character-class-escape';
import { buildDisjunctionCharacterReader } from '../nodes/disjunction';
import { buildDotCharacterReader } from '../nodes/dot';
import { buildReferenceCharacterReader } from '../nodes/reference';
import { buildSequenceCharacterReader } from '../nodes/sequence';
import { buildUnicodePropertyEscapeCharacterReader } from '../nodes/unicode-property-escape';
import { buildValueCharacterReader } from '../nodes/value';
import { CharacterGroups } from '../character-groups';
import { MyRootNode } from '../parse';
import { Reader } from '../reader';

export const characterReaderTypeCharacterEntry: unique symbol = Symbol(
  'characterReaderTypeCharacterEntry'
);
export const characterReaderTypeSplit: unique symbol = Symbol(
  'characterReaderTypeSplit'
);

export type CharacterReaderValueSplit = {
  // eslint-disable-next-line no-use-before-define
  reader: () => CharacterReader;
  type: typeof characterReaderTypeSplit;
};

export type CharacterReaderValueGroups = {
  groups: Groups;
  lookaheadStack: LookaheadStack;
  quantifierStack: QuantifierStack;
  type: typeof characterReaderTypeCharacterEntry;
} & (
  | {
      characterGroups: CharacterGroups;
      node:
        | CharacterClass
        | CharacterClassEscape
        | Dot
        | UnicodePropertyEscape
        | Value;
      subType: 'groups';
    }
  | {
      node: Reference;
      referenceIndex: number;
      subType: 'reference';
    }
  | { offset: number; subType: 'end' }
  | { offset: number; subType: 'null' }
  | { offset: number; subType: 'start' }
);

export type CharacterReaderValue =
  | CharacterReaderValueGroups
  | CharacterReaderValueSplit;

export type CharacterReader = Reader<CharacterReaderValue>;

export function buildCharacterReader(node: MyRootNode): CharacterReader {
  switch (node.type) {
    case 'anchor':
      return buildAnchorReader(node);
    case 'characterClass':
      return buildCharacterClassCharacterReader(node);
    case 'characterClassEscape':
      return buildCharacterClassEscapeReader(node);
    case 'unicodePropertyEscape':
      return buildUnicodePropertyEscapeCharacterReader(node);
    case 'reference':
      return buildReferenceCharacterReader(node);
    case 'value':
      return buildValueCharacterReader(node);
    case 'dot':
      return buildDotCharacterReader(node);
    case 'alternative':
      return buildSequenceCharacterReader(node.body);
    case 'disjunction':
      return buildDisjunctionCharacterReader(node);
    case 'group':
      return buildGroupCharacterReader(node);
    case 'quantifier':
      return buildQuantifierCharacterReader(node);
  }
}