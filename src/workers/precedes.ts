/**
 * precedes.ts — ordering / precedence utilities for the todo worker layer.
 *
 * Determines whether one ordered item precedes another, and provides helpers
 * for sorting collections by natural creation order.
 */

export interface Ordered {
  id: number | string;
  createdAt?: Date | string | number;
}

/**
 * Returns `true` if item `a` precedes item `b`.
 *
 * Resolution order:
 *  1. `createdAt` timestamps (if both are present) — earlier timestamp wins.
 *  2. Numeric `id` comparison (if both ids are numbers).
 *  3. Lexicographic string comparison of the string-coerced ids.
 */
export function precedes(a: Ordered, b: Ordered): boolean {
  if (a.createdAt !== undefined && b.createdAt !== undefined) {
    const ta =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : new Date(a.createdAt as string | number).getTime();
    const tb =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : new Date(b.createdAt as string | number).getTime();
    return ta < tb;
  }

  if (typeof a.id === 'number' && typeof b.id === 'number') {
    return a.id < b.id;
  }

  return String(a.id) < String(b.id);
}

/**
 * Returns a new array sorted so that items that precede others come first.
 * Ties (equal timestamps or equal ids) preserve relative input order (stable).
 */
export function sortByPrecedence<T extends Ordered>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (precedes(a, b)) return -1;
    if (precedes(b, a)) return 1;
    return 0;
  });
}

/**
 * Returns the item that precedes all others (i.e. the earliest/first one).
 * Returns `undefined` for an empty collection.
 */
export function earliest<T extends Ordered>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items.reduce<T>((min, cur) => (precedes(cur, min) ? cur : min), items[0]);
}
