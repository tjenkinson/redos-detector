import { intersectRanges, OurRange } from './our-range';
import { mergeSets, subtractSets } from './sets';

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

function intersectTwoCharacterGroups(
  a: CharacterGroups,
  b: CharacterGroups
): CharacterGroups {
  let newRanges: OurRange[];
  let newChracterClassEscapes: ReadonlySet<string>;
  let newUnicodePropertyEscapes: ReadonlySet<string>;
  let newNegated: boolean;
  let newDot: boolean;

  if (a.dot || b.dot) {
    if (a.dot && b.dot) {
      newDot = true;
      newNegated = false;
      newRanges = [];
      newChracterClassEscapes = new Set();
      newUnicodePropertyEscapes = new Set();
    } else if (a.dot) {
      newDot = false;
      newNegated = b.negated;
      newRanges = b.ranges;
      newChracterClassEscapes = b.characterClassEscapes;
      newUnicodePropertyEscapes = b.unicodePropertyEscapes;
    } else {
      newDot = false;
      newNegated = a.negated;
      newRanges = a.ranges;
      newChracterClassEscapes = a.characterClassEscapes;
      newUnicodePropertyEscapes = a.unicodePropertyEscapes;
    }
  } else {
    newDot = false;
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
  }

  return {
    characterClassEscapes: newChracterClassEscapes,
    dot: newDot,
    negated: newNegated,
    ranges: newRanges,
    unicodePropertyEscapes: newUnicodePropertyEscapes,
  };
}

export function intersectCharacterGroups(
  groups: readonly CharacterGroups[]
): CharacterGroups {
  let res = groups[0];
  for (let i = 1; i < groups.length; i++) {
    res = intersectTwoCharacterGroups(res, groups[i]);
  }
  return res;
}
