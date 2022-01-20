import { intersectRanges, OurRange } from './our-range';
import { mergeSets, subtractSets } from './set';

export type MutableCharacterGroups = {
  characterClassEscapes: Set<string>;
  dot: boolean;
  negated: boolean;
  ranges: OurRange[];
  unicodePropertyEscapes: Set<string>;
};

export type CharacterGroups = Readonly<{
  characterClassEscapes: ReadonlySet<string>;
  dot: boolean;
  negated: boolean;
  ranges: OurRange[];
  unicodePropertyEscapes: ReadonlySet<string>;
}>;

/**
 * Returns `true` if the provided `CharacterGroups` definitely matches no characters.
 */
export function isEmptyCharacterGroups(group: CharacterGroups): boolean {
  return (
    !group.negated &&
    !group.ranges.length &&
    !group.dot &&
    !group.characterClassEscapes.size &&
    !group.unicodePropertyEscapes.size
  );
}

export function intersectCharacterGroups(
  a: CharacterGroups,
  b: CharacterGroups
): CharacterGroups {
  let newRanges: OurRange[];
  let newChracterClassEscapes: Set<string>;
  let newUnicodePropertyEscapes: Set<string>;
  let newNegated: boolean;

  if (!a.negated) {
    if (!b.negated) {
      newNegated = false;
      newRanges = [];
      a.ranges.forEach((aRange) => {
        b.ranges.forEach((bRange) => {
          const intersection = intersectRanges(aRange, bRange);
          if (intersection) {
            newRanges.push(intersection.shared);
          }
        });
      });
      newChracterClassEscapes = mergeSets(
        a.characterClassEscapes,
        b.characterClassEscapes
      );
      newUnicodePropertyEscapes = mergeSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes
      );
    } else {
      newNegated = false;
      newRanges = [...a.ranges];
      b.ranges.forEach((bRange) => {
        const narrowed: OurRange[] = [];
        newRanges.forEach((aRange) => {
          const intersection = intersectRanges(aRange, bRange);
          if (!intersection) {
            narrowed.push(aRange);
          } else {
            narrowed.push(...intersection.a);
          }
        });
        newRanges = narrowed;
      });
      // assume all escapes in a are not cancelled in b
      // except exact matches
      newChracterClassEscapes = subtractSets(
        a.characterClassEscapes,
        b.characterClassEscapes
      );
      newUnicodePropertyEscapes = subtractSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes
      );
    }
  } else {
    if (!b.negated) {
      newNegated = false;
      newRanges = [...b.ranges];
      a.ranges.forEach((aRange) => {
        const narrowed: OurRange[] = [];
        newRanges.forEach((bRange) => {
          const intersection = intersectRanges(aRange, bRange);
          if (!intersection) {
            narrowed.push(bRange);
          } else {
            narrowed.push(...intersection.b);
          }
        });
        newRanges = narrowed;
      });
      // assume all escapes in b were covered in the not-a
      // except exact matches
      newChracterClassEscapes = subtractSets(
        b.characterClassEscapes,
        a.characterClassEscapes
      );
      newUnicodePropertyEscapes = subtractSets(
        b.unicodePropertyEscapes,
        a.unicodePropertyEscapes
      );
    } else {
      newNegated = true;
      newRanges = [];
      a.ranges.forEach((aRange) => {
        b.ranges.forEach((bRange) => {
          newRanges.push(aRange);
          newRanges.push(bRange);
        });
      });
      newChracterClassEscapes = mergeSets(
        a.characterClassEscapes,
        b.characterClassEscapes
      );
      newUnicodePropertyEscapes = mergeSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes
      );
    }
  }

  return {
    characterClassEscapes: newChracterClassEscapes,
    dot: a.dot || b.dot,
    negated: newNegated,
    ranges: newRanges,
    unicodePropertyEscapes: newUnicodePropertyEscapes,
  };
}
