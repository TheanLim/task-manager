import { describe, it, expect } from 'vitest';
import { AppState, Priority, ViewMode, TimeManagementSystem } from '@/types';

/**
 * Tests for project-only sharing functionality
 */
describe('Project-Only Sharing', () => {
  // Helper to create test state
  const createTestState = (numProjects: number, tasksPerProject: number): AppState => {
    const projects = [];
    const tasks = [];
    const sections = [];
    const dependencies = [];
    
    for (let i = 0; i < numProjects; i++) {
      const projectId = `project-${i}`;
      
      // Create project
      projects.push({
        id: projectId,
        name: `Project ${i}`,
        description: `Description for project ${i}`,
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Create sections for project
      for (let s = 0; s < 3; s++) {
        sections.push({
          id: `${projectId}-section-${s}`,
          projectId,
          name: ['To Do', 'Doing', 'Done'][s],
          order: s,
          collapsed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Create tasks for project
      for (let t = 0; t < tasksPerProject; t++) {
        const taskId = `${projectId}-task-${t}`;
        tasks.push({
          id: taskId,
          projectId,
          parentTaskId: null,
          sectionId: `${projectId}-section-0`,
          description: `Task ${t} for project ${i}`,
          notes: `Notes for task ${t}`,
          assignee: 'user@example.com',
          priority: Priority.MEDIUM,
          tags: ['tag1', 'tag2'],
          dueDate: null,
          completed: false,
          completedAt: null,
          order: t,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Create some dependencies
      if (tasksPerProject > 1) {
        dependencies.push({
          id: `${projectId}-dep-0`,
          blockingTaskId: `${projectId}-task-0`,
          blockedTaskId: `${projectId}-task-1`,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    return {
      projects,
      tasks,
      sections,
      dependencies,
      tmsState: {
        activeSystem: TimeManagementSystem.NONE,
        dit: {
          todayTasks: [],
          tomorrowTasks: [],
          lastDayChange: new Date().toISOString()
        },
        af4: {
          markedTasks: [],
          markedOrder: []
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false
        }
      },
      settings: {
        activeProjectId: null,
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'system'
      },
      version: '1.0.0'
    };
  };
  
  // Helper to filter state to single project
  const filterToProject = (state: AppState, projectId: string): AppState => {
    const project = state.projects.find(p => p.id === projectId);
    const projectTasks = state.tasks.filter(t => t.projectId === projectId);
    const projectSections = state.sections.filter(s => s.projectId === projectId);
    const taskIds = new Set(projectTasks.map(t => t.id));
    const projectDeps = state.dependencies.filter(d => 
      taskIds.has(d.blockingTaskId) && taskIds.has(d.blockedTaskId)
    );
    
    return {
      projects: project ? [project] : [],
      tasks: projectTasks,
      sections: projectSections,
      dependencies: projectDeps,
      tmsState: {
        activeSystem: state.tmsState.activeSystem,
        dit: {
          todayTasks: state.tmsState.dit.todayTasks.filter(id => taskIds.has(id)),
          tomorrowTasks: state.tmsState.dit.tomorrowTasks.filter(id => taskIds.has(id)),
          lastDayChange: state.tmsState.dit.lastDayChange
        },
        af4: {
          markedTasks: state.tmsState.af4.markedTasks.filter(id => taskIds.has(id)),
          markedOrder: state.tmsState.af4.markedOrder.filter(id => taskIds.has(id))
        },
        fvp: {
          dottedTasks: state.tmsState.fvp.dottedTasks.filter(id => taskIds.has(id)),
          currentX: taskIds.has(state.tmsState.fvp.currentX || '') ? state.tmsState.fvp.currentX : null,
          selectionInProgress: state.tmsState.fvp.selectionInProgress
        }
      },
      settings: state.settings,
      version: state.version
    };
  };

  describe('Filtering to Single Project', () => {
    it('should filter state to include only specified project', () => {
      const fullState = createTestState(3, 10); // 3 projects, 10 tasks each
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.projects).toHaveLength(1);
      expect(filtered.projects[0].id).toBe('project-1');
    });

    it('should include only tasks from specified project', () => {
      const fullState = createTestState(3, 10);
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.tasks).toHaveLength(10);
      expect(filtered.tasks.every(t => t.projectId === 'project-1')).toBe(true);
    });

    it('should include only sections from specified project', () => {
      const fullState = createTestState(3, 10);
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.sections).toHaveLength(3);
      expect(filtered.sections.every(s => s.projectId === 'project-1')).toBe(true);
    });

    it('should include only dependencies within specified project', () => {
      const fullState = createTestState(3, 10);
      const filtered = filterToProject(fullState, 'project-1');
      
      const taskIds = new Set(filtered.tasks.map(t => t.id));
      expect(filtered.dependencies.every(d => 
        taskIds.has(d.blockingTaskId) && taskIds.has(d.blockedTaskId)
      )).toBe(true);
    });

    it('should filter TMS state to only include project tasks', () => {
      const fullState = createTestState(3, 10);
      
      // Add some tasks to TMS state
      fullState.tmsState.dit.todayTasks = ['project-0-task-0', 'project-1-task-0', 'project-2-task-0'];
      fullState.tmsState.af4.markedTasks = ['project-0-task-1', 'project-1-task-1'];
      fullState.tmsState.fvp.dottedTasks = ['project-1-task-2', 'project-2-task-2'];
      
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.tmsState.dit.todayTasks).toEqual(['project-1-task-0']);
      expect(filtered.tmsState.af4.markedTasks).toEqual(['project-1-task-1']);
      expect(filtered.tmsState.fvp.dottedTasks).toEqual(['project-1-task-2']);
    });

    it('should handle project with no tasks', () => {
      const fullState = createTestState(1, 0); // 1 project, 0 tasks
      const filtered = filterToProject(fullState, 'project-0');
      
      expect(filtered.projects).toHaveLength(1);
      expect(filtered.tasks).toHaveLength(0);
      expect(filtered.dependencies).toHaveLength(0);
    });

    it('should handle non-existent project', () => {
      const fullState = createTestState(3, 10);
      const filtered = filterToProject(fullState, 'non-existent');
      
      expect(filtered.projects).toHaveLength(0);
      expect(filtered.tasks).toHaveLength(0);
      expect(filtered.sections).toHaveLength(0);
      expect(filtered.dependencies).toHaveLength(0);
    });
  });

  describe('Data Size Comparison', () => {
    it('should significantly reduce data size when filtering to single project', () => {
      const fullState = createTestState(5, 50); // 5 projects, 50 tasks each = 250 tasks total
      const filtered = filterToProject(fullState, 'project-2');
      
      const fullSize = JSON.stringify(fullState).length;
      const filteredSize = JSON.stringify(filtered).length;
      
      // Filtered should be roughly 1/5 the size (one project out of five)
      expect(filteredSize).toBeLessThan(fullSize * 0.3); // Allow some overhead
      expect(filtered.tasks).toHaveLength(50);
      expect(fullState.tasks).toHaveLength(250);
    });

    it('should handle large single project', () => {
      const fullState = createTestState(1, 200); // 1 project, 200 tasks
      const filtered = filterToProject(fullState, 'project-0');
      
      expect(filtered.tasks).toHaveLength(200);
      expect(filtered.projects).toHaveLength(1);
      
      // Size should be similar since we're keeping everything
      const fullSize = JSON.stringify(fullState).length;
      const filteredSize = JSON.stringify(filtered).length;
      expect(filteredSize).toBeGreaterThan(fullSize * 0.9);
    });
  });

  describe('Data Integrity After Filtering', () => {
    it('should maintain referential integrity', () => {
      const fullState = createTestState(3, 20);
      const filtered = filterToProject(fullState, 'project-1');
      
      // All task projectIds should match
      expect(filtered.tasks.every(t => t.projectId === 'project-1')).toBe(true);
      
      // All section projectIds should match
      expect(filtered.sections.every(s => s.projectId === 'project-1')).toBe(true);
      
      // All task sectionIds should reference existing sections
      const sectionIds = new Set(filtered.sections.map(s => s.id));
      expect(filtered.tasks.every(t => t.sectionId === null || sectionIds.has(t.sectionId))).toBe(true);
      
      // All dependencies should reference existing tasks
      const taskIds = new Set(filtered.tasks.map(t => t.id));
      expect(filtered.dependencies.every(d => 
        taskIds.has(d.blockingTaskId) && taskIds.has(d.blockedTaskId)
      )).toBe(true);
    });

    it('should preserve all task fields', () => {
      const fullState = createTestState(2, 5);
      const filtered = filterToProject(fullState, 'project-0');
      
      const originalTask = fullState.tasks.find(t => t.projectId === 'project-0');
      const filteredTask = filtered.tasks.find(t => t.id === originalTask?.id);
      
      expect(filteredTask).toEqual(originalTask);
    });

    it('should preserve settings and version', () => {
      const fullState = createTestState(3, 10);
      fullState.settings.activeProjectId = 'project-1';
      fullState.settings.theme = 'dark';
      
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.settings).toEqual(fullState.settings);
      expect(filtered.version).toBe(fullState.version);
    });
  });

  describe('Edge Cases', () => {
    it('should handle project with subtasks', () => {
      const fullState = createTestState(1, 5);
      
      // Add subtasks
      fullState.tasks.push({
        id: 'subtask-1',
        projectId: 'project-0',
        parentTaskId: 'project-0-task-0',
        sectionId: 'project-0-section-0',
        description: 'Subtask 1',
        notes: '',
        assignee: '',
        priority: Priority.LOW,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const filtered = filterToProject(fullState, 'project-0');
      
      expect(filtered.tasks).toHaveLength(6); // 5 parent + 1 subtask
      expect(filtered.tasks.some(t => t.parentTaskId === 'project-0-task-0')).toBe(true);
    });

    it('should handle cross-project dependencies correctly', () => {
      const fullState = createTestState(2, 5);
      
      // Add cross-project dependency (should be filtered out)
      fullState.dependencies.push({
        id: 'cross-dep',
        blockingTaskId: 'project-0-task-0',
        blockedTaskId: 'project-1-task-0',
        createdAt: new Date().toISOString()
      });
      
      const filtered = filterToProject(fullState, 'project-0');
      
      // Cross-project dependency should not be included
      expect(filtered.dependencies.every(d => {
        const taskIds = new Set(filtered.tasks.map(t => t.id));
        return taskIds.has(d.blockingTaskId) && taskIds.has(d.blockedTaskId);
      })).toBe(true);
      
      expect(filtered.dependencies.some(d => d.id === 'cross-dep')).toBe(false);
    });

    it('should handle empty TMS state', () => {
      const fullState = createTestState(2, 10);
      const filtered = filterToProject(fullState, 'project-1');
      
      expect(filtered.tmsState.dit.todayTasks).toEqual([]);
      expect(filtered.tmsState.af4.markedTasks).toEqual([]);
      expect(filtered.tmsState.fvp.dottedTasks).toEqual([]);
    });
  });
});
