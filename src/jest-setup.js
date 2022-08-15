afterAll(() => {
  // prevents
  // "A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them."
  // happening
  // This seems to be because the process is taking too long to terminate, as a result of GC taking too long during the timeout period
  // Doing this moves the GC to before the request for the process to stop where the timeout is running
  // See https://github.com/facebook/jest/pull/13139
  global.gc?.();
});
