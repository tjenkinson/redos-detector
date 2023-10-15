import { intersectRanges, OurRange, subtractRanges } from './our-range';
import { mergeSets, subtractSets } from './sets';

export type MutableCharacterGroups = {
  dot: boolean;
  negated: boolean;
  ranges: OurRange[];
  unicodePropertyEscapes: Set<string>;
};

export type CharacterGroups = Readonly<{
  negated: boolean;
  ranges: readonly OurRange[];
  unicodePropertyEscapes: ReadonlySet<string>;
}>;

/**
 * Returns `true` if the provided `CharacterGroups` definitely matches no characters.
 */
export function isEmptyCharacterGroups(group: CharacterGroups): boolean {
  return (
    !group.negated && !group.ranges.length && !group.unicodePropertyEscapes.size
  );
}

export function intersectCharacterGroups(
  a: CharacterGroups,
  b: CharacterGroups,
): CharacterGroups {
  let newRanges: OurRange[];
  let newUnicodePropertyEscapes: ReadonlySet<string>;
  let newNegated: boolean;

  if (!a.negated) {
    if (!b.negated) {
      newNegated = false;
      newRanges = [];
      a.ranges.forEach((aRange) => {
        b.ranges.forEach((bRange) => {
          const intersection = intersectRanges(aRange, bRange);
          if (intersection) newRanges.push(intersection);
        });
      });
      newUnicodePropertyEscapes = mergeSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes,
      );
    } else {
      newNegated = false;
      newRanges = [...a.ranges];
      b.ranges.forEach((bRange) => {
        const narrowed: OurRange[] = [];
        newRanges.forEach((aRange) => {
          narrowed.push(...subtractRanges(aRange, bRange));
        });
        newRanges = narrowed;
      });
      // assume all escapes in a are not cancelled in b
      // except exact matches
      newUnicodePropertyEscapes = subtractSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes,
      );
    }
  } else {
    if (!b.negated) {
      newNegated = false;
      newRanges = [...b.ranges];
      a.ranges.forEach((aRange) => {
        const narrowed: OurRange[] = [];
        newRanges.forEach((bRange) => {
          narrowed.push(...subtractRanges(bRange, aRange));
        });
        newRanges = narrowed;
      });
      // assume all escapes in b were covered in the not-a
      // except exact matches
      newUnicodePropertyEscapes = subtractSets(
        b.unicodePropertyEscapes,
        a.unicodePropertyEscapes,
      );
    } else {
      newNegated = true;
      newRanges = [...a.ranges, ...b.ranges];
      newUnicodePropertyEscapes = mergeSets(
        a.unicodePropertyEscapes,
        b.unicodePropertyEscapes,
      );
    }
  }

  return {
    negated: newNegated,
    ranges: newRanges,
    unicodePropertyEscapes: newUnicodePropertyEscapes,
  };
}
