/**
 * parallel.ts — lightweight parallel task runner
 *
 * Runs an array of async tasks with a configurable concurrency limit,
 * collecting results (or errors) without aborting the whole batch on
 * a single failure.
 */

export interface ParallelOptions {
  /** Maximum number of tasks running concurrently. Defaults to Infinity. */
  concurrency?: number;
}

export interface ParallelResult<T> {
  index: number;
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
}

/**
 * Run `tasks` in parallel, honouring an optional `concurrency` cap.
 *
 * @returns An array of result descriptors in original task order.
 */
export async function runParallel<T>(
  tasks: Array<() => Promise<T>>,
  options: ParallelOptions = {},
): Promise<ParallelResult<T>[]> {
  const concurrency =
    options.concurrency !== undefined && options.concurrency > 0
      ? options.concurrency
      : Infinity;

  const results: ParallelResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        const value = await tasks[index]();
        results[index] = { index, status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { index, status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  if (workerCount === 0) return results;

  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Convenience wrapper: like `Promise.all` but with a concurrency cap.
 * Rejects with the first encountered error (equivalent to
 * `Promise.all` semantics, just bounded).
 */
export async function pMap<T, U>(
  items: T[],
  mapper: (item: T, index: number) => Promise<U>,
  options: ParallelOptions = {},
): Promise<U[]> {
  const tasks = items.map((item, i) => () => mapper(item, i));
  const results = await runParallel(tasks, options);

  return results.map((r) => {
    if (r.status === 'rejected') throw r.reason;
    return r.value as U;
  });
}
