import {
  SynchronisationCheckerKeysInput,
  SynchronisationCheckerKeyState,
} from './synchronisation-checker';
import { buildQuantifierTrail } from './nodes/quantifier';
import { Groups } from './nodes/group';

export type AtomicGroupsToSynchronisationCheckerInput = Readonly<{
  atomicGroupOffsets: ReadonlySet<number>;
  leftGroupsNow: Groups;
  leftPreceedingGroups: Groups[];
  rightGroupsNow: Groups;
  rightPreceedingGroups: Groups[];
}>;

/**
 * Creates the input for `SynchronisationChecker` based off
 * groups.
 *
 * The preceeding groups are groups that were skipped
 * over. E.g `(a)?` for the case where `?` means `{0}`
 */
export function atomicGroupsToSynchronisationCheckerKeys({
  atomicGroupOffsets,
  leftGroupsNow,
  leftPreceedingGroups,
  rightGroupsNow,
  rightPreceedingGroups,
}: AtomicGroupsToSynchronisationCheckerInput): SynchronisationCheckerKeysInput {
  const atomicGroupsToKeys = (groups: Groups): ReadonlySet<string> => {
    return new Set(
      [...groups]
        .filter(([group]) => atomicGroupOffsets.has(group.range[0]))
        .map(([group, { quantifierStack }]) => {
          return `${group.range[0]}:${buildQuantifierTrail(
            quantifierStack,
            false
          )}`;
        })
    );
  };

  const leftKeys = atomicGroupsToKeys(leftGroupsNow);
  const rightKeys = atomicGroupsToKeys(rightGroupsNow);

  const leftZeroWidthKeys = new Set(
    leftPreceedingGroups.map((groups) => [...atomicGroupsToKeys(groups)]).flat()
  );
  const rightZeroWidthKeys = new Set(
    rightPreceedingGroups
      .map((groups) => [...atomicGroupsToKeys(groups)])
      .flat()
  );

  const leftKeyState: Map<string, SynchronisationCheckerKeyState> = new Map();
  for (const key of leftZeroWidthKeys) {
    leftKeyState.set(key, 'wasPresent');
  }
  for (const key of leftKeys) {
    leftKeyState.set(key, 'present');
  }

  const rightKeyState: Map<string, SynchronisationCheckerKeyState> = new Map();
  for (const key of rightZeroWidthKeys) {
    rightKeyState.set(key, 'wasPresent');
  }
  for (const key of rightKeys) {
    rightKeyState.set(key, 'present');
  }

  return {
    leftKeyState,
    rightKeyState,
  };
}
