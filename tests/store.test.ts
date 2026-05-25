import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/store/store.js';
import type { Store } from '../src/store/types.js';

describe('createStore', () => {
  it('createStore returns independent instances', () => {
    const a = createStore();
    const b = createStore();
    a.createList('A');
    expect(b.getLists()).toHaveLength(0);
  });
});

describe('createList', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('createList trims the name', () => {
    const list = store.createList('  hello  ');
    expect(list.name).toBe('hello');
  });

  it('createList assigns unique id and trimmed name', () => {
    const a = store.createList('A');
    const b = store.createList('B');
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('A');
  });

  it('getLists returns lists newest-first', () => {
    const first = store.createList('first');
    const second = store.createList('second');
    const third = store.createList('third');
    const lists = store.getLists();
    expect(lists[0].id).toBe(third.id);
    expect(lists[1].id).toBe(second.id);
    expect(lists[2].id).toBe(first.id);
  });

  it('getLists returns a defensive copy', () => {
    store.createList('X');
    const lists = store.getLists();
    lists.push({ id: 'fake', name: 'injected' });
    expect(store.getLists()).toHaveLength(1);
  });
});

describe('createTodo', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('createTodo returns todo with done=false', () => {
    const list = store.createList('mylist');
    const todo = store.createTodo(list.id, 'do something');
    expect(todo.done).toBe(false);
    expect(todo.listId).toBe(list.id);
    expect(todo.text).toBe('do something');
  });

  it('createTodo assigns unique id', () => {
    const list = store.createList('mylist');
    const a = store.createTodo(list.id, 'task a');
    const b = store.createTodo(list.id, 'task b');
    expect(typeof a.id).toBe('string');
    expect(a.id).not.toBe(b.id);
  });
});

describe('getTodosByList', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('getTodosByList returns only that list\'s todos', () => {
    const l1 = store.createList('L1');
    const l2 = store.createList('L2');
    const t1 = store.createTodo(l1.id, 'from L1');
    store.createTodo(l2.id, 'from L2');
    const result = store.getTodosByList(l1.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(t1.id);
  });

  it('getTodosByList returns [] for a list with no todos', () => {
    const list = store.createList('empty');
    expect(store.getTodosByList(list.id)).toEqual([]);
  });

  it('getTodosByList returns a defensive copy', () => {
    const list = store.createList('L');
    store.createTodo(list.id, 'task');
    const todos = store.getTodosByList(list.id);
    todos.push({ id: 'x', listId: list.id, text: 'injected', done: false });
    expect(store.getTodosByList(list.id)).toHaveLength(1);
  });
});

describe('getTodoById', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('getTodoById returns todo or undefined', () => {
    const list = store.createList('L');
    const todo = store.createTodo(list.id, 'task');
    expect(store.getTodoById(todo.id)).toEqual(todo);
    expect(store.getTodoById('nonexistent')).toBeUndefined();
  });
});

describe('toggleTodo', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('toggleTodo flips done from false to true', () => {
    const list = store.createList('L');
    const todo = store.createTodo(list.id, 'task');
    expect(todo.done).toBe(false);
    const updated = store.toggleTodo(todo.id);
    expect(updated).toBeDefined();
    expect(updated!.done).toBe(true);
    expect(updated!.id).toBe(todo.id);
  });

  it('toggleTodo flips done from true to false on second call', () => {
    const list = store.createList('L');
    const todo = store.createTodo(list.id, 'task');
    store.toggleTodo(todo.id);
    const updated = store.toggleTodo(todo.id);
    expect(updated!.done).toBe(false);
  });

  it('toggleTodo returns undefined for unknown id', () => {
    expect(store.toggleTodo('unknown')).toBeUndefined();
  });
});

describe('deleteTodo', () => {
  let store: Store;
  beforeEach(() => { store = createStore(); });

  it('deleteTodo removes the todo and returns true', () => {
    const list = store.createList('L');
    const todo = store.createTodo(list.id, 'task');
    expect(store.deleteTodo(todo.id)).toBe(true);
  });

  it('deleteTodo returns false for unknown id', () => {
    expect(store.deleteTodo('ghost')).toBe(false);
  });

  it('deleted todo is no longer retrievable', () => {
    const list = store.createList('L');
    const todo = store.createTodo(list.id, 'task');
    store.deleteTodo(todo.id);
    expect(store.getTodoById(todo.id)).toBeUndefined();
  });
});

describe('getSnapshot', () => {
  it('getSnapshot returns newest-first lists and defensive array copies', () => {
    const store = createStore();
    const l1 = store.createList('first');
    const l2 = store.createList('second');
    const t1 = store.createTodo(l1.id, 'task1');
    const t2 = store.createTodo(l2.id, 'task2');

    const snap = store.getSnapshot();

    // lists newest-first
    expect(snap.lists[0].id).toBe(l2.id);
    expect(snap.lists[1].id).toBe(l1.id);

    // todos present
    expect(snap.todos).toHaveLength(2);
    expect(snap.todos.find(t => t.id === t1.id)).toBeDefined();
    expect(snap.todos.find(t => t.id === t2.id)).toBeDefined();

    // defensive copies
    snap.lists.push({ id: 'x', name: 'injected' });
    snap.todos.push({ id: 'y', listId: 'z', text: 'bad', done: false });
    expect(store.getLists()).toHaveLength(2);
    const snap2 = store.getSnapshot();
    expect(snap2.todos).toHaveLength(2);
  });
});
