import { Task } from '@/types';
import type { AF4State } from './types';

export function initialize(tasks: Task[], af4State: AF4State): Partial<AF4State> {
  const incompleteTasks = tasks.filter(t => !t.completed);
  return {
    ...af4State, backlogTaskIds: incompleteTasks.map(t => t.id),
    activeListTaskIds: [], currentPosition: 0, lastPassHadWork: false,
    dismissedTaskIds: [], phase: 'backlog',
  };
}

export function getOrderedTasks(tasks: Task[], af4State: AF4State): Task[] {
  const { backlogTaskIds, activeListTaskIds } = af4State;
  const allListedIds = new Set([...backlogTaskIds, ...activeListTaskIds]);
  const backlog = backlogTaskIds.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => t !== undefined);
  const active = activeListTaskIds.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => t !== undefined);
  const unlisted = tasks.filter(t => !allListedIds.has(t.id));
  return [...backlog, ...active, ...unlisted];
}

export function onTaskCreated(task: Task, af4State: AF4State): Partial<AF4State> {
  return { ...af4State, activeListTaskIds: [...af4State.activeListTaskIds, task.id] };
}

export function onTaskCompleted(task: Task, af4State: AF4State): Partial<AF4State> {
  const { backlogTaskIds, activeListTaskIds, currentPosition, phase } = af4State;
  if (!backlogTaskIds.includes(task.id) && !activeListTaskIds.includes(task.id)) return {};
  const newBacklog = backlogTaskIds.filter(id => id !== task.id);
  const newActive = activeListTaskIds.filter(id => id !== task.id);
  let newPosition = currentPosition;
  const currentList = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  const completedIndex = currentList.indexOf(task.id);
  if (completedIndex !== -1 && completedIndex < currentPosition) {
    newPosition = Math.max(0, currentPosition - 1);
  }
  return { ...af4State, backlogTaskIds: newBacklog, activeListTaskIds: newActive, currentPosition: newPosition };
}

export function madeProgress(tasks: Task[], af4State: AF4State): Partial<AF4State> {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds } = af4State;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  if (currentPosition >= list.length) return {};
  const taskId = list[currentPosition];
  const newBacklog = backlogTaskIds.filter(id => id !== taskId);
  const newActive = [...activeListTaskIds.filter(id => id !== taskId), taskId];
  return { ...af4State, backlogTaskIds: newBacklog, activeListTaskIds: newActive, currentPosition, lastPassHadWork: true };
}

export function markDone(tasks: Task[], af4State: AF4State): Partial<AF4State> {
  const { phase, currentPosition, backlogTaskIds, activeListTaskIds, dismissedTaskIds } = af4State;
  const list = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  if (currentPosition >= list.length) return {};
  const taskId = list[currentPosition];
  return {
    ...af4State,
    backlogTaskIds: backlogTaskIds.filter(id => id !== taskId),
    activeListTaskIds: activeListTaskIds.filter(id => id !== taskId),
    dismissedTaskIds: dismissedTaskIds.filter(id => id !== taskId),
    currentPosition,
  };
}

export function skipTask(af4State: AF4State): Partial<AF4State> {
  return { ...af4State, currentPosition: af4State.currentPosition + 1 };
}

export function advanceAfterFullPass(tasks: Task[], af4State: AF4State): Partial<AF4State> {
  const { phase, lastPassHadWork, backlogTaskIds, activeListTaskIds } = af4State;
  const activeBacklog = backlogTaskIds.filter(id => { const t = tasks.find(task => task.id === id); return t && !t.completed; });
  if (activeBacklog.length === 0 && phase === 'backlog') {
    return { ...af4State, backlogTaskIds: activeListTaskIds, activeListTaskIds: [], currentPosition: 0, lastPassHadWork: false, phase: 'backlog' };
  }
  if (phase === 'backlog' && !lastPassHadWork) {
    return { ...af4State, currentPosition: 0, phase: 'active' };
  }
  return { ...af4State, currentPosition: 0, lastPassHadWork: false, phase: 'backlog' };
}

export function dismissTask(taskId: string, af4State: AF4State): Partial<AF4State> {
  if (af4State.dismissedTaskIds.includes(taskId)) return {};
  return { ...af4State, dismissedTaskIds: [...af4State.dismissedTaskIds, taskId] };
}

export function resolveDismissed(taskId: string, resolution: 'abandon' | 're-enter' | 'defer', af4State: AF4State): Partial<AF4State> {
  const dismissed = af4State.dismissedTaskIds.filter(id => id !== taskId);
  if (resolution === 'abandon') {
    return { ...af4State, backlogTaskIds: af4State.backlogTaskIds.filter(id => id !== taskId), activeListTaskIds: af4State.activeListTaskIds.filter(id => id !== taskId), dismissedTaskIds: dismissed };
  }
  if (resolution === 're-enter') {
    return { ...af4State, backlogTaskIds: af4State.backlogTaskIds.filter(id => id !== taskId), activeListTaskIds: [...af4State.activeListTaskIds.filter(id => id !== taskId), taskId], dismissedTaskIds: dismissed };
  }
  return { ...af4State, dismissedTaskIds: dismissed };
}

export function onTaskDeleted(taskId: string, af4State: AF4State): Partial<AF4State> {
  const { backlogTaskIds, activeListTaskIds, dismissedTaskIds, currentPosition, phase } = af4State;
  if (!backlogTaskIds.includes(taskId) && !activeListTaskIds.includes(taskId) && !dismissedTaskIds.includes(taskId)) return {};
  const newBacklog = backlogTaskIds.filter(id => id !== taskId);
  const newActive = activeListTaskIds.filter(id => id !== taskId);
  const newDismissed = dismissedTaskIds.filter(id => id !== taskId);
  const currentList = phase === 'backlog' ? backlogTaskIds : activeListTaskIds;
  const deletedIndex = currentList.indexOf(taskId);
  let newPosition = currentPosition;
  if (deletedIndex !== -1 && deletedIndex < currentPosition) { newPosition = Math.max(0, currentPosition - 1); }
  return { ...af4State, backlogTaskIds: newBacklog, activeListTaskIds: newActive, dismissedTaskIds: newDismissed, currentPosition: newPosition };
}
