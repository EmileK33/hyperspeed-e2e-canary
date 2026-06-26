import { describe, it, expect, vi } from 'vitest';
import { runParallel, pMap } from '../src/workers/parallel.ts';

describe('runParallel', () => {
  it('returns an empty array when given no tasks', async () => {
    const results = await runParallel([]);
    expect(results).toEqual([]);
  });

  it('runs all tasks and returns fulfilled results in order', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];
    const results = await runParallel(tasks);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ index: 0, status: 'fulfilled', value: 1 });
    expect(results[1]).toMatchObject({ index: 1, status: 'fulfilled', value: 2 });
    expect(results[2]).toMatchObject({ index: 2, status: 'fulfilled', value: 3 });
  });

  it('captures rejected tasks without throwing', async () => {
    const err = new Error('boom');
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(err),
      () => Promise.resolve('also ok'),
    ];
    const results = await runParallel(tasks);

    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'ok' });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: err });
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'also ok' });
  });

  it('respects the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const makeTask = () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      active--;
    };

    const tasks = Array.from({ length: 6 }, makeTask);
    await runParallel(tasks, { concurrency: 2 });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('runs all tasks when concurrency exceeds task count', async () => {
    const tasks = [() => Promise.resolve('a'), () => Promise.resolve('b')];
    const results = await runParallel(tasks, { concurrency: 10 });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('defaults to unlimited concurrency (no concurrency option)', async () => {
    let active = 0;
    let maxActive = 0;

    const makeTask = () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      active--;
    };

    const tasks = Array.from({ length: 5 }, makeTask);
    await runParallel(tasks);

    // With unlimited concurrency all 5 should start simultaneously
    expect(maxActive).toBe(5);
  });
});

describe('pMap', () => {
  it('maps items to results in order', async () => {
    const result = await pMap([1, 2, 3], async (n) => n * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it('throws on the first mapper rejection', async () => {
    const err = new Error('map fail');
    await expect(
      pMap([1, 2, 3], async (n) => {
        if (n === 2) throw err;
        return n;
      }),
    ).rejects.toThrow(err);
  });

  it('respects concurrency option', async () => {
    let active = 0;
    let maxActive = 0;

    await pMap(
      Array.from({ length: 8 }, (_, i) => i),
      async (i) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        active--;
        return i;
      },
      { concurrency: 3 },
    );

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('handles an empty input array', async () => {
    const result = await pMap([], async (x: number) => x);
    expect(result).toEqual([]);
  });
});
