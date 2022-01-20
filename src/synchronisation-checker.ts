import { mergeSets } from './set';

export type SynchronisationCheckerKeyState = 'present' | 'wasPresent';
export type SynchronisationCheckerStateByKey = ReadonlyMap<
  string,
  SynchronisationCheckerKeyState
>;
export type SynchronisationCheckerKeysInSync = ReadonlyMap<string, boolean>;
export type SynchronisationCheckerResult = Readonly<
  | {
      keysInSync: SynchronisationCheckerKeysInSync;
      type: 'inSync';
    }
  | {
      type: 'goneOutOfSync';
    }
>;

function getPresentKeys(
  keyState: SynchronisationCheckerStateByKey
): ReadonlySet<string> {
  return new Set(
    [...keyState].filter(([, state]) => state === 'present').map(([key]) => key)
  );
}

export type SynchronisationCheckerKeysInput = Readonly<{
  leftKeyState: SynchronisationCheckerStateByKey;
  rightKeyState: SynchronisationCheckerStateByKey;
}>;

// We have gone out of sync if a key that appeared in left and right
// at the same time does not dissapear at the same time.
// It's possible for a key to appear and dissapear between calls,
// which is represented with `wasPresent`.
export function synchronisationCheck(
  keysInSync: SynchronisationCheckerKeysInSync,
  { leftKeyState, rightKeyState }: SynchronisationCheckerKeysInput
): SynchronisationCheckerResult {
  const newKeysInSync: Map<string, boolean> = new Map();
  for (const key of mergeSets(
    getPresentKeys(leftKeyState),
    getPresentKeys(rightKeyState)
  )) {
    const wasInSync = keysInSync.get(key);

    const leftState =
      leftKeyState.get(key) || (wasInSync ? 'wasPresent' : null);
    const rightState =
      rightKeyState.get(key) || (wasInSync ? 'wasPresent' : null);

    if (
      (leftState === 'wasPresent' && rightState === 'present') ||
      (rightState === 'wasPresent' && leftState === 'present')
    ) {
      return { type: 'goneOutOfSync' };
    }

    newKeysInSync.set(
      key,
      wasInSync !== false && leftState === 'present' && rightState === 'present'
    );
  }
  return { keysInSync: newKeysInSync, type: 'inSync' };
}
