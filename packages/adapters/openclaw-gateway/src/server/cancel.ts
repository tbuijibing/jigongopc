/**
 * Cancellation support for OpenClaw Gateway adapter runs.
 *
 * Provides a registry for cancel handlers keyed by runId, and a helper
 * to race a promise against an AbortSignal.
 */

// ---------------------------------------------------------------------------
// CancellationRegistry
// ---------------------------------------------------------------------------

export class CancellationRegistry {
  private readonly handlers = new Map<string, () => Promise<void>>();
  /** Tracks runIds whose handler has already been invoked (idempotency guard). */
  private readonly cancelled = new Set<string>();

  /** Register a cancel handler for the given runId. */
  register(runId: string, handler: () => Promise<void>): void {
    this.handlers.set(runId, handler);
  }

  /** Remove the cancel handler for the given runId and clear its cancelled flag. */
  unregister(runId: string): void {
    this.handlers.delete(runId);
    this.cancelled.delete(runId);
  }

  /**
   * Cancel the run identified by `runId`.
   *
   * - If no handler is registered (or already unregistered), this is a no-op.
   * - If the handler was already invoked for this runId, this is a no-op
   *   (idempotent — the handler will not be called twice).
   */
  async cancel(runId: string): Promise<void> {
    if (this.cancelled.has(runId)) return;

    const handler = this.handlers.get(runId);
    if (!handler) return;

    this.cancelled.add(runId);
    await handler();
  }
}

// ---------------------------------------------------------------------------
// raceWithAbort
// ---------------------------------------------------------------------------

/**
 * Race a promise against an `AbortSignal`.
 *
 * - If the signal is already aborted when called, resolves immediately with `null`.
 * - If the signal fires before the promise settles, resolves with `null`.
 * - If the promise settles first, its value (or rejection) propagates normally.
 */
export function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);

  return new Promise<T | null>((resolve, reject) => {
    const onAbort = () => resolve(null);
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}
