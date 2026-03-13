import { describe, it, expect, vi } from "vitest";
import { CancellationRegistry, raceWithAbort } from "../cancel.js";

// ---------------------------------------------------------------------------
// CancellationRegistry
// ---------------------------------------------------------------------------

describe("CancellationRegistry", () => {
  it("calls the registered handler on cancel", async () => {
    const registry = new CancellationRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);

    registry.register("run-1", handler);
    await registry.cancel("run-1");

    expect(handler).toHaveBeenCalledOnce();
  });

  it("cancel is a no-op when no handler is registered", async () => {
    const registry = new CancellationRegistry();
    // Should not throw
    await registry.cancel("unknown-run");
  });

  it("cancel is idempotent — handler is invoked at most once", async () => {
    const registry = new CancellationRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);

    registry.register("run-1", handler);
    await registry.cancel("run-1");
    await registry.cancel("run-1");
    await registry.cancel("run-1");

    expect(handler).toHaveBeenCalledOnce();
  });

  it("unregister removes the handler so subsequent cancel is a no-op", async () => {
    const registry = new CancellationRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);

    registry.register("run-1", handler);
    registry.unregister("run-1");
    await registry.cancel("run-1");

    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister resets the cancelled flag so re-register + cancel works", async () => {
    const registry = new CancellationRegistry();
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);

    registry.register("run-1", handler1);
    await registry.cancel("run-1");
    expect(handler1).toHaveBeenCalledOnce();

    // Unregister clears the cancelled flag
    registry.unregister("run-1");

    // Re-register with a new handler
    registry.register("run-1", handler2);
    await registry.cancel("run-1");
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("handles multiple independent runIds", async () => {
    const registry = new CancellationRegistry();
    const h1 = vi.fn().mockResolvedValue(undefined);
    const h2 = vi.fn().mockResolvedValue(undefined);

    registry.register("run-a", h1);
    registry.register("run-b", h2);

    await registry.cancel("run-a");
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();

    await registry.cancel("run-b");
    expect(h2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// raceWithAbort
// ---------------------------------------------------------------------------

describe("raceWithAbort", () => {
  it("resolves with the promise value when signal is not aborted", async () => {
    const controller = new AbortController();
    const result = await raceWithAbort(Promise.resolve(42), controller.signal);
    expect(result).toBe(42);
  });

  it("resolves with null immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const neverResolve = new Promise<number>(() => {});
    const result = await raceWithAbort(neverResolve, controller.signal);
    expect(result).toBeNull();
  });

  it("resolves with null when signal aborts before promise settles", async () => {
    const controller = new AbortController();
    const neverResolve = new Promise<number>(() => {});

    const racePromise = raceWithAbort(neverResolve, controller.signal);
    controller.abort();

    const result = await racePromise;
    expect(result).toBeNull();
  });

  it("rejects when the promise rejects before abort", async () => {
    const controller = new AbortController();
    const error = new Error("boom");

    await expect(
      raceWithAbort(Promise.reject(error), controller.signal),
    ).rejects.toThrow("boom");
  });

  it("resolves with the promise value even if abort fires after settlement", async () => {
    const controller = new AbortController();
    const result = await raceWithAbort(Promise.resolve("done"), controller.signal);
    // Abort after settlement — should have no effect
    controller.abort();
    expect(result).toBe("done");
  });
});

import fc from "fast-check";

// ---------------------------------------------------------------------------
// Cancel handler lifecycle in execute flow context
// ---------------------------------------------------------------------------

describe("Cancel handler lifecycle (execute integration)", () => {
  /**
   * Simulates the cancel handler lifecycle as implemented in execute():
   * 1. Register cancel handler before agent.wait
   * 2. Run the wait (or cancel)
   * 3. Unregister in finally block
   */
  function simulateExecuteWithCancel(opts: {
    registry: CancellationRegistry;
    runId: string;
    cancelDuringWait: boolean;
    waitResolveValue?: unknown;
  }) {
    const cancelRequestFn = vi.fn().mockResolvedValue(undefined);
    const abortController = new AbortController();

    const handler = async () => {
      await cancelRequestFn();
      abortController.abort();
    };

    opts.registry.register(opts.runId, handler);

    return {
      cancelRequestFn,
      abortController,
      async run() {
        try {
          if (opts.cancelDuringWait) {
            // Simulate cancellation during wait
            await opts.registry.cancel(opts.runId);
          }

          const waitResult = await raceWithAbort(
            opts.cancelDuringWait
              ? new Promise<unknown>(() => {}) // never resolves — simulates long wait
              : Promise.resolve(opts.waitResolveValue ?? { status: "ok" }),
            abortController.signal,
          );

          if (abortController.signal.aborted || waitResult === null) {
            return {
              exitCode: 1,
              errorCode: "openclaw_gateway_cancelled",
              errorMessage: "Run cancelled by operator",
            };
          }

          return { exitCode: 0 };
        } finally {
          opts.registry.unregister(opts.runId);
        }
      },
    };
  }

  it("unregisters handler after normal completion", async () => {
    const registry = new CancellationRegistry();
    const sim = simulateExecuteWithCancel({
      registry,
      runId: "run-normal",
      cancelDuringWait: false,
    });

    const result = await sim.run();
    expect(result.exitCode).toBe(0);

    // Handler should be unregistered — cancelling now should be a no-op
    const lateHandler = vi.fn().mockResolvedValue(undefined);
    registry.register("run-normal", lateHandler);
    await registry.cancel("run-normal");
    // The late handler should fire (proving the old one was cleaned up)
    expect(lateHandler).toHaveBeenCalledOnce();
    expect(sim.cancelRequestFn).not.toHaveBeenCalled();
  });

  it("calls agent.cancel and returns correct errorCode on cancellation", async () => {
    const registry = new CancellationRegistry();
    const sim = simulateExecuteWithCancel({
      registry,
      runId: "run-cancel",
      cancelDuringWait: true,
    });

    const result = await sim.run();
    expect(result.exitCode).toBe(1);
    expect(result).toHaveProperty("errorCode", "openclaw_gateway_cancelled");
    expect(result).toHaveProperty("errorMessage", "Run cancelled by operator");
    expect(sim.cancelRequestFn).toHaveBeenCalledOnce();
  });

  it("unregisters handler after cancellation (finally block)", async () => {
    const registry = new CancellationRegistry();
    const sim = simulateExecuteWithCancel({
      registry,
      runId: "run-cancel-cleanup",
      cancelDuringWait: true,
    });

    await sim.run();

    // After execute returns, the handler should be unregistered
    // Registering a new handler and cancelling should invoke the new one
    const newHandler = vi.fn().mockResolvedValue(undefined);
    registry.register("run-cancel-cleanup", newHandler);
    await registry.cancel("run-cancel-cleanup");
    expect(newHandler).toHaveBeenCalledOnce();
  });

  it("repeated cancellation does not error", async () => {
    const registry = new CancellationRegistry();
    const cancelRequestFn = vi.fn().mockResolvedValue(undefined);
    const abortController = new AbortController();

    registry.register("run-repeat", async () => {
      await cancelRequestFn();
      abortController.abort();
    });

    // Cancel multiple times — should not throw
    await registry.cancel("run-repeat");
    await registry.cancel("run-repeat");
    await registry.cancel("run-repeat");

    expect(cancelRequestFn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Property 5: Cancel handler lifecycle cleanup
// ---------------------------------------------------------------------------

describe("Property 5: Cancel handler lifecycle cleanup", () => {
  /**
   * **Validates: Requirements 5.4, 5.5**
   *
   * For any execution path (normal completion or cancellation),
   * the cancel handler is always unregistered after execute returns.
   */
  it("handler is always cleaned up regardless of execution path", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          runId: fc.string({ minLength: 1, maxLength: 50 }),
          shouldCancel: fc.boolean(),
        }),
        async ({ runId, shouldCancel }) => {
          const registry = new CancellationRegistry();
          const handler = vi.fn().mockResolvedValue(undefined);
          const abortController = new AbortController();

          registry.register(runId, async () => {
            await handler();
            abortController.abort();
          });

          try {
            if (shouldCancel) {
              await registry.cancel(runId);
            }
            // Simulate wait completing
            await raceWithAbort(
              shouldCancel
                ? new Promise(() => {})
                : Promise.resolve({ status: "ok" }),
              abortController.signal,
            );
          } finally {
            registry.unregister(runId);
          }

          // After unregister, a fresh handler should be registerable and callable
          const freshHandler = vi.fn().mockResolvedValue(undefined);
          registry.register(runId, freshHandler);
          await registry.cancel(runId);
          expect(freshHandler).toHaveBeenCalledOnce();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Cancellation idempotency
// ---------------------------------------------------------------------------

describe("Property 6: Cancellation idempotency", () => {
  /**
   * **Validates: Requirements 5.4, 5.5**
   *
   * For any runId and any number of cancel calls (1..N),
   * the handler is invoked at most once and no errors are thrown.
   */
  it("multiple cancel calls invoke handler at most once without errors", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          runId: fc.string({ minLength: 1, maxLength: 50 }),
          cancelCount: fc.integer({ min: 1, max: 20 }),
        }),
        async ({ runId, cancelCount }) => {
          const registry = new CancellationRegistry();
          const handler = vi.fn().mockResolvedValue(undefined);

          registry.register(runId, handler);

          // Call cancel N times — should never throw
          for (let i = 0; i < cancelCount; i++) {
            await registry.cancel(runId);
          }

          // Handler invoked exactly once regardless of cancelCount
          expect(handler).toHaveBeenCalledOnce();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("cancel on unregistered runId is always a no-op", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        async (runId, cancelCount) => {
          const registry = new CancellationRegistry();

          // Cancel without registering — should never throw
          for (let i = 0; i < cancelCount; i++) {
            await registry.cancel(runId);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
