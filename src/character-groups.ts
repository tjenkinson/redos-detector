import { intersectRanges, OurRange, subtractRanges } from './our-range';

export type CharacterGroups = Readonly<{
  rangesNegated: boolean;
  ranges: readonly OurRange[];
  unicodePropertyEscapes: ReadonlyMap<string, boolean /* negated */>;
}>;

/**
 * Returns `true` if the provided `CharacterGroups` definitely matches no characters.
 */
export function isEmptyCharacterGroups(group: CharacterGroups): boolean {
  return (
    !group.rangesNegated &&
    !group.ranges.length &&
    !group.unicodePropertyEscapes.size
  );
}

export function intersectCharacterGroups(
  a: CharacterGroups,
  b: CharacterGroups,
): CharacterGroups {
  let newRanges: OurRange[];
  let newNegated: boolean;

  if (!a.rangesNegated) {
    if (!b.rangesNegated) {
      newNegated = false;
      newRanges = [];
      a.ranges.forEach((aRange) => {
        b.ranges.forEach((bRange) => {
          const intersection = intersectRanges(aRange, bRange);
          if (intersection) newRanges.push(intersection);
        });
      });
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
    }
  } else {
    if (!b.rangesNegated) {
      newNegated = false;
      newRanges = [...b.ranges];
      a.ranges.forEach((aRange) => {
        const narrowed: OurRange[] = [];
        newRanges.forEach((bRange) => {
          narrowed.push(...subtractRanges(bRange, aRange));
        });
        newRanges = narrowed;
      });
    } else {
      newNegated = true;
      newRanges = [...a.ranges, ...b.ranges];
    }
  }

  const allUnicodePropertyEscapes = new Set([
    ...a.unicodePropertyEscapes.keys(),
    ...b.unicodePropertyEscapes.keys(),
  ]);

  const newUnicodePropertyEscapes: Map<string, boolean> = new Map();
  for (const unicodePropertyEscape of allUnicodePropertyEscapes) {
    const aEscape = a.unicodePropertyEscapes.get(unicodePropertyEscape) ?? null;
    const bEscape = b.unicodePropertyEscapes.get(unicodePropertyEscape) ?? null;

    // assume that all characters that match an escape (or inverse of escape) remain, unless
    // they are intersected with the negative
    // `isEmptyCharacterGroups` will never be `true` whilst there is an escape
    if (aEscape !== null && bEscape === null) {
      newUnicodePropertyEscapes.set(unicodePropertyEscape, aEscape);
    } else if (aEscape === null && bEscape !== null) {
      newUnicodePropertyEscapes.set(unicodePropertyEscape, bEscape);
    } else if (aEscape !== null && bEscape !== null && aEscape === bEscape) {
      newUnicodePropertyEscapes.set(unicodePropertyEscape, aEscape);
    }
  }

  return {
    ranges: newRanges,
    rangesNegated: newNegated,
    unicodePropertyEscapes: newUnicodePropertyEscapes,
  };
}
