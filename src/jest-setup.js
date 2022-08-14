afterAll(() => {
  // prevents
  // "A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them."
  // happening
  // My theory is without the forced GC the `FinalisationRegistry` we use hasn't run for everything yet and jest thinks the `heldValue`'s registered there are leaks
  global.gc?.();
});
