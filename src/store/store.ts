import { randomUUID } from 'node:crypto';
import type { List, Todo, StoreSnapshot, Store } from './types.js';

export function createStore(): Store {
  const lists: List[] = [];
  const todos: Todo[] = [];

  return {
    createList(name: string): List {
      const list: List = { id: randomUUID(), name: name.trim() };
      lists.unshift(list);
      return list;
    },

    getLists(): List[] {
      return [...lists];
    },

    createTodo(listId: string, text: string): Todo {
      const todo: Todo = { id: randomUUID(), listId, text, done: false };
      todos.push(todo);
      return todo;
    },

    getTodosByList(listId: string): Todo[] {
      return todos.filter(t => t.listId === listId);
    },

    getTodoById(id: string): Todo | undefined {
      return todos.find(t => t.id === id);
    },

    toggleTodo(id: string): Todo | undefined {
      const todo = todos.find(t => t.id === id);
      if (!todo) return undefined;
      todo.done = !todo.done;
      return todo;
    },

    deleteTodo(id: string): boolean {
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) return false;
      todos.splice(idx, 1);
      return true;
    },

    getSnapshot(): StoreSnapshot {
      return { lists: [...lists], todos: [...todos] };
    },
  };
}
