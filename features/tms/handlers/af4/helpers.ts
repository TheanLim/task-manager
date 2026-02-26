import { Task } from '@/types';
import type { AF4State } from './types';

export function getCurrentTask(tasks: Task[], af4State: AF4State): Task | null {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds } = af4State;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  if (list.length === 0 || currentPosition >= list.length) return null;
  const id = list[currentPosition];
  return tasks.find(t => t.id === id) ?? null;
}

export function isFullPassComplete(af4State: AF4State): boolean {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds } = af4State;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  return currentPosition >= list.length;
}

export function isBacklogEmpty(tasks: Task[], af4State: AF4State): boolean {
  return af4State.backlogTaskIds.every(id => {
    const t = tasks.find(task => task.id === id);
    return !t || t.completed;
  });
}
