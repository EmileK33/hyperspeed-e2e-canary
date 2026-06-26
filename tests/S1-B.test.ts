import { describe, it, expect } from 'vitest';
import { precedes, sortByPrecedence, earliest } from '../src/workers/precedes.ts';

// ---------------------------------------------------------------------------
// precedes()
// ---------------------------------------------------------------------------
describe('precedes()', () => {
  describe('numeric ids (no createdAt)', () => {
    it('returns true when a.id < b.id', () => {
      expect(precedes({ id: 1 }, { id: 2 })).toBe(true);
    });

    it('returns false when a.id > b.id', () => {
      expect(precedes({ id: 5 }, { id: 3 })).toBe(false);
    });

    it('returns false for equal ids', () => {
      expect(precedes({ id: 4 }, { id: 4 })).toBe(false);
    });
  });

  describe('string ids (no createdAt)', () => {
    it('returns true when a.id lexicographically precedes b.id', () => {
      expect(precedes({ id: 'abc' }, { id: 'abd' })).toBe(true);
    });

    it('returns false when a.id lexicographically follows b.id', () => {
      expect(precedes({ id: 'z' }, { id: 'a' })).toBe(false);
    });
  });

  describe('createdAt timestamps (takes precedence over id)', () => {
    it('returns true when a was created before b (Date objects)', () => {
      const a = { id: 99, createdAt: new Date('2024-01-01T00:00:00Z') };
      const b = { id: 1,  createdAt: new Date('2024-06-01T00:00:00Z') };
      expect(precedes(a, b)).toBe(true);
    });

    it('returns false when a was created after b (Date objects)', () => {
      const a = { id: 1, createdAt: new Date('2025-01-01T00:00:00Z') };
      const b = { id: 2, createdAt: new Date('2024-01-01T00:00:00Z') };
      expect(precedes(a, b)).toBe(false);
    });

    it('supports ISO string timestamps', () => {
      const a = { id: 1, createdAt: '2023-03-01T00:00:00Z' };
      const b = { id: 2, createdAt: '2023-09-01T00:00:00Z' };
      expect(precedes(a, b)).toBe(true);
    });

    it('supports numeric epoch timestamps', () => {
      const a = { id: 1, createdAt: 1000 };
      const b = { id: 2, createdAt: 2000 };
      expect(precedes(a, b)).toBe(true);
      expect(precedes(b, a)).toBe(false);
    });

    it('falls back to id comparison when only one item has createdAt', () => {
      // Only a has createdAt — branch falls through to id comparison
      const a = { id: 1, createdAt: new Date() };
      const b = { id: 2 };
      // b.createdAt is undefined, so timestamp branch is skipped → id compare
      expect(precedes(a, b)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// sortByPrecedence()
// ---------------------------------------------------------------------------
describe('sortByPrecedence()', () => {
  it('sorts numeric-id items ascending', () => {
    const items = [{ id: 3 }, { id: 1 }, { id: 2 }];
    const sorted = sortByPrecedence(items);
    expect(sorted.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it('sorts by createdAt when present', () => {
    const items = [
      { id: 1, createdAt: '2024-06-01T00:00:00Z' },
      { id: 2, createdAt: '2024-01-01T00:00:00Z' },
      { id: 3, createdAt: '2024-03-01T00:00:00Z' },
    ];
    const sorted = sortByPrecedence(items);
    expect(sorted.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it('does not mutate the original array', () => {
    const items = [{ id: 2 }, { id: 1 }];
    const original = [...items];
    sortByPrecedence(items);
    expect(items).toEqual(original);
  });

  it('handles an empty array', () => {
    expect(sortByPrecedence([])).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(sortByPrecedence([{ id: 42 }])).toEqual([{ id: 42 }]);
  });
});

// ---------------------------------------------------------------------------
// earliest()
// ---------------------------------------------------------------------------
describe('earliest()', () => {
  it('returns undefined for an empty collection', () => {
    expect(earliest([])).toBeUndefined();
  });

  it('returns the sole item from a single-element collection', () => {
    const item = { id: 7 };
    expect(earliest([item])).toBe(item);
  });

  it('returns the item with the lowest id', () => {
    const items = [{ id: 3 }, { id: 1 }, { id: 2 }];
    expect(earliest(items)).toEqual({ id: 1 });
  });

  it('returns the item with the earliest createdAt', () => {
    const items = [
      { id: 1, createdAt: '2024-06-01T00:00:00Z' },
      { id: 2, createdAt: '2024-01-01T00:00:00Z' },
      { id: 3, createdAt: '2024-03-01T00:00:00Z' },
    ];
    expect(earliest(items)?.id).toBe(2);
  });
});
