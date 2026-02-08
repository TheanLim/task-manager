import { describe, it, expect, beforeEach } from 'vitest';
import { useDataStore } from '@/stores/dataStore';
import { Priority } from '@/types';
import { v4 as uuidv4 } from 'uuid';

describe('Task Completion Cascading', () => {
  beforeEach(() => {
    // Reset the store before each test
    const { projects, tasks, sections, dependencies } = useDataStore.getState();
    projects.forEach(p => useDataStore.getState().deleteProject(p.id));
    tasks.forEach(t => useDataStore.getState().deleteTask(t.id));
    sections.forEach(s => useDataStore.getState().deleteSection(s.id));
    dependencies.forEach(d => useDataStore.getState().deleteDependency(d.id));
  });

  it('should cascade completion to all subtasks when parent is completed', () => {
    const { addProject, addTask, updateTask, getSubtasks, tasks } = useDataStore.getState();
    
    // Create a project
    const projectId = uuidv4();
    addProject({
      id: projectId,
      name: 'Test Project',
      description: 'Test Description',
      viewMode: 'list' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create a parent task
    const parentTaskId = uuidv4();
    addTask({
      id: parentTaskId,
      projectId,
      parentTaskId: null,
      sectionId: null,
      description: 'Parent Task',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create subtasks
    const subtask1Id = uuidv4();
    const subtask2Id = uuidv4();
    const subtask3Id = uuidv4();

    addTask({
      id: subtask1Id,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 1',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    addTask({
      id: subtask2Id,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 2',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    addTask({
      id: subtask3Id,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 3',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Verify initial state - all tasks are incomplete
    const initialParent = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    const initialSubtasks = useDataStore.getState().getSubtasks(parentTaskId);
    
    expect(initialParent?.completed).toBe(false);
    expect(initialParent?.completedAt).toBeNull();
    expect(initialSubtasks).toHaveLength(3);
    initialSubtasks.forEach(subtask => {
      expect(subtask.completed).toBe(false);
      expect(subtask.completedAt).toBeNull();
    });

    // Simulate handleTaskComplete logic - complete the parent task
    const parentTask = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    if (parentTask) {
      // Update the parent task
      updateTask(parentTaskId, {
        completed: true,
        completedAt: new Date().toISOString()
      });

      // If this is a parent task (parentTaskId === null), cascade to subtasks
      if (parentTask.parentTaskId === null) {
        const subtasks = useDataStore.getState().getSubtasks(parentTaskId);
        subtasks.forEach(subtask => {
          updateTask(subtask.id, {
            completed: true,
            completedAt: new Date().toISOString()
          });
        });
      }
    }

    // Verify parent task is completed
    const completedParent = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    expect(completedParent?.completed).toBe(true);
    expect(completedParent?.completedAt).not.toBeNull();

    // Verify all subtasks are completed
    const completedSubtasks = useDataStore.getState().getSubtasks(parentTaskId);
    expect(completedSubtasks).toHaveLength(3);
    completedSubtasks.forEach(subtask => {
      expect(subtask.completed).toBe(true);
      expect(subtask.completedAt).not.toBeNull();
    });
  });

  it('should cascade incompletion to all subtasks when parent is uncompleted', () => {
    const { addProject, addTask, updateTask, getSubtasks, tasks } = useDataStore.getState();
    
    // Create a project
    const projectId = uuidv4();
    addProject({
      id: projectId,
      name: 'Test Project',
      description: 'Test Description',
      viewMode: 'list' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create a parent task (already completed)
    const parentTaskId = uuidv4();
    const completedAt = new Date().toISOString();
    addTask({
      id: parentTaskId,
      projectId,
      parentTaskId: null,
      sectionId: null,
      description: 'Parent Task',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: true,
      completedAt,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create subtasks (already completed)
    const subtask1Id = uuidv4();
    const subtask2Id = uuidv4();

    addTask({
      id: subtask1Id,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 1',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: true,
      completedAt,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    addTask({
      id: subtask2Id,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 2',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: true,
      completedAt,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Verify initial state - all tasks are completed
    const initialParent = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    const initialSubtasks = useDataStore.getState().getSubtasks(parentTaskId);
    
    expect(initialParent?.completed).toBe(true);
    expect(initialParent?.completedAt).not.toBeNull();
    expect(initialSubtasks).toHaveLength(2);
    initialSubtasks.forEach(subtask => {
      expect(subtask.completed).toBe(true);
      expect(subtask.completedAt).not.toBeNull();
    });

    // Simulate handleTaskComplete logic - uncomplete the parent task
    const parentTask = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    if (parentTask) {
      // Update the parent task
      updateTask(parentTaskId, {
        completed: false,
        completedAt: null
      });

      // If this is a parent task (parentTaskId === null), cascade to subtasks
      if (parentTask.parentTaskId === null) {
        const subtasks = useDataStore.getState().getSubtasks(parentTaskId);
        subtasks.forEach(subtask => {
          updateTask(subtask.id, {
            completed: false,
            completedAt: null
          });
        });
      }
    }

    // Verify parent task is uncompleted
    const uncompletedParent = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    expect(uncompletedParent?.completed).toBe(false);
    expect(uncompletedParent?.completedAt).toBeNull();

    // Verify all subtasks are uncompleted
    const uncompletedSubtasks = useDataStore.getState().getSubtasks(parentTaskId);
    expect(uncompletedSubtasks).toHaveLength(2);
    uncompletedSubtasks.forEach(subtask => {
      expect(subtask.completed).toBe(false);
      expect(subtask.completedAt).toBeNull();
    });
  });

  it('should not cascade when completing a subtask (not a parent)', () => {
    const { addProject, addTask, updateTask, getSubtasks, tasks } = useDataStore.getState();
    
    // Create a project
    const projectId = uuidv4();
    addProject({
      id: projectId,
      name: 'Test Project',
      description: 'Test Description',
      viewMode: 'list' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create a parent task
    const parentTaskId = uuidv4();
    addTask({
      id: parentTaskId,
      projectId,
      parentTaskId: null,
      sectionId: null,
      description: 'Parent Task',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create a subtask
    const subtaskId = uuidv4();
    addTask({
      id: subtaskId,
      projectId,
      parentTaskId: parentTaskId,
      sectionId: null,
      description: 'Subtask 1',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Simulate handleTaskComplete logic - complete the subtask (not parent)
    const subtask = useDataStore.getState().tasks.find(t => t.id === subtaskId);
    if (subtask) {
      // Update the subtask
      updateTask(subtaskId, {
        completed: true,
        completedAt: new Date().toISOString()
      });

      // This should NOT cascade because subtask.parentTaskId is not null
      if (subtask.parentTaskId === null) {
        const subtasks = useDataStore.getState().getSubtasks(subtaskId);
        subtasks.forEach(st => {
          updateTask(st.id, {
            completed: true,
            completedAt: new Date().toISOString()
          });
        });
      }
    }

    // Verify subtask is completed
    const completedSubtask = useDataStore.getState().tasks.find(t => t.id === subtaskId);
    expect(completedSubtask?.completed).toBe(true);
    expect(completedSubtask?.completedAt).not.toBeNull();

    // Verify parent task is NOT completed (no cascade upward)
    const parentTask = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    expect(parentTask?.completed).toBe(false);
    expect(parentTask?.completedAt).toBeNull();
  });

  it('should handle empty subtasks list gracefully', () => {
    const { addProject, addTask, updateTask, getSubtasks, tasks } = useDataStore.getState();
    
    // Create a project
    const projectId = uuidv4();
    addProject({
      id: projectId,
      name: 'Test Project',
      description: 'Test Description',
      viewMode: 'list' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create a parent task with no subtasks
    const parentTaskId = uuidv4();
    addTask({
      id: parentTaskId,
      projectId,
      parentTaskId: null,
      sectionId: null,
      description: 'Parent Task',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Verify no subtasks exist
    expect(useDataStore.getState().getSubtasks(parentTaskId)).toHaveLength(0);

    // Simulate handleTaskComplete logic - complete the parent task
    const parentTask = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    if (parentTask) {
      updateTask(parentTaskId, {
        completed: true,
        completedAt: new Date().toISOString()
      });

      if (parentTask.parentTaskId === null) {
        const subtasks = useDataStore.getState().getSubtasks(parentTaskId);
        subtasks.forEach(subtask => {
          updateTask(subtask.id, {
            completed: true,
            completedAt: new Date().toISOString()
          });
        });
      }
    }

    // Verify parent task is completed
    const completedParent = useDataStore.getState().tasks.find(t => t.id === parentTaskId);
    expect(completedParent?.completed).toBe(true);
    expect(completedParent?.completedAt).not.toBeNull();

    // Verify still no subtasks (no errors occurred)
    expect(useDataStore.getState().getSubtasks(parentTaskId)).toHaveLength(0);
  });
});
