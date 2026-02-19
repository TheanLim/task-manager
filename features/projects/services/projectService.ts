import { v4 as uuidv4 } from 'uuid';
import type { UUID, Section, ViewMode } from '@/types';
import type {
  ProjectRepository,
  SectionRepository,
  TaskRepository,
} from '@/lib/repositories/types';
import type { Project } from '@/lib/schemas';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { AutomationRuleRepository } from '@/features/automations/repositories/types';

export class ProjectService {
  constructor(
    private projectRepo: ProjectRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    private taskRepo: TaskRepository,
    private automationRuleRepo: AutomationRuleRepository
  ) {}

  /**
   * Create a project and its three default sections (To Do, Doing, Done).
   */
  createWithDefaults(project: Project): void {
    this.projectRepo.create(project);

    const now = new Date().toISOString();

    const defaultSections: Section[] = [
      {
        id: `${project.id}-section-todo`,
        projectId: project.id,
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${project.id}-section-doing`,
        projectId: project.id,
        name: 'Doing',
        order: 1,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${project.id}-section-done`,
        projectId: project.id,
        name: 'Done',
        order: 2,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const section of defaultSections) {
      this.sectionRepo.create(section);
    }
  }
  /**
   * Static factory: create a new Project with generated ID and timestamps.
   */
  static create(data: { name: string; description: string; viewMode: ViewMode }): Project {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
  }



  /**
   * Cascade-delete a project: remove all automation rules, all tasks (via TaskService for subtask/dependency cleanup),
   * all sections, and the project itself.
   *
   * Validates Requirement: 8.3
   */
  cascadeDelete(projectId: UUID): void {
    // Delete all automation rules for this project first
    const rules = this.automationRuleRepo.findByProjectId(projectId);
    for (const rule of rules) {
      this.automationRuleRepo.delete(rule.id);
    }

    // Find all project tasks, then cascade-delete only top-level ones
    // (TaskService.cascadeDelete handles subtasks and dependencies)
    const tasks = this.taskRepo.findByProjectId(projectId);
    const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
    for (const task of topLevelTasks) {
      this.taskService.cascadeDelete(task.id);
    }

    // Delete all sections for this project
    const sections = this.sectionRepo.findByProjectId(projectId);
    for (const section of sections) {
      this.sectionRepo.delete(section.id);
    }

    // Delete the project itself
    this.projectRepo.delete(projectId);
  }
}
