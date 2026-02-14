import type { UUID, Section } from '@/types';
import type {
  ProjectRepository,
  SectionRepository,
  TaskRepository,
} from '@/lib/repositories/types';
import type { Project } from '@/lib/schemas';
import type { TaskService } from '@/features/tasks/services/taskService';

export class ProjectService {
  constructor(
    private projectRepo: ProjectRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    private taskRepo: TaskRepository
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
   * Cascade-delete a project: remove all tasks (via TaskService for subtask/dependency cleanup),
   * all sections, and the project itself.
   */
  cascadeDelete(projectId: UUID): void {
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
