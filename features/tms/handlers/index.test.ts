import { describe, it, expect } from 'vitest';
import { getTMSHandler } from './index';
import { TimeManagementSystem, TMSState, Priority, Task } from '@/types';

const createDefaultTMSState = (): TMSState => ({
  activeSystem: TimeManagementSystem.NONE,
  dit: {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: new Date().toISOString(),
  },
  af4: {
    markedTasks: [],
    markedOrder: [],
  },
  fvp: {
    dottedTasks: [],
    currentX: null,
    selectionInProgress: false,
  },
});

const createTask = (id: string, order: number): Task => ({
  id,
  projectId: 'project-1',
  parentTaskId: null,
  sectionId: null,
  description: `Task ${id}`,
  notes: '',
  assignee: '',
  priority: Priority.NONE,
  tags: [],
  dueDate: null,
  completed: false,
  completedAt: null,
  order,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('TMS Factory', () => {
  it('should return DITHandler for DIT system', () => {
    const handler = getTMSHandler(TimeManagementSystem.DIT);
    expect(handler.name).toBe(TimeManagementSystem.DIT);
  });

  it('should return AF4Handler for AF4 system', () => {
    const handler = getTMSHandler(TimeManagementSystem.AF4);
    expect(handler.name).toBe(TimeManagementSystem.AF4);
  });

  it('should return FVPHandler for FVP system', () => {
    const handler = getTMSHandler(TimeManagementSystem.FVP);
    expect(handler.name).toBe(TimeManagementSystem.FVP);
  });

  it('should return StandardHandler for NONE system', () => {
    const handler = getTMSHandler(TimeManagementSystem.NONE);
    expect(handler.name).toBe(TimeManagementSystem.NONE);
  });

  it('should throw error for unknown system', () => {
    expect(() => getTMSHandler('unknown' as TimeManagementSystem)).toThrow('Unknown time management system');
  });

  it('should return handlers with pure function interface', () => {
    const handler = getTMSHandler(TimeManagementSystem.NONE);
    const tmsState = createDefaultTMSState();
    const tasks = [createTask('t1', 1), createTask('t2', 0)];

    // All methods accept state as arguments and return results
    const ordered = handler.getOrderedTasks(tasks, tmsState);
    expect(ordered).toHaveLength(2);

    const initDelta = handler.initialize(tasks, tmsState);
    expect(initDelta).toEqual({});

    const createDelta = handler.onTaskCreated(tasks[0], tmsState);
    expect(createDelta).toEqual({});

    const completeDelta = handler.onTaskCompleted(tasks[0], tmsState);
    expect(completeDelta).toEqual({});
  });
});
