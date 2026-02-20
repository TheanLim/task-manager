import type { UUID } from '@/types';
import type { Section } from '@/lib/schemas';
import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '@/features/automations/repositories/types';
import { detectBrokenRules } from '@/features/automations/services/rules/brokenRuleDetector';
import { v4 as uuidv4 } from 'uuid';

/**
 * SectionService handles section-level business logic:
 * - Create sections with defaults (centralizes entity construction)
 * - Cascade-delete: reassign tasks to "To Do" section, then delete, then detect broken rules
 */
export class SectionService {
  constructor(
    private sectionRepo: SectionRepository,
    private taskRepo: TaskRepository,
    private automationRuleRepo: AutomationRuleRepository
  ) {}

  /**
   * Create a new section with generated ID and timestamps.
   * Centralizes entity construction per architecture rule #5.
   */
  createWithDefaults(name: string, projectId: UUID | null, order: number): Section {
    const now = new Date().toISOString();
    const section: Section = {
      id: uuidv4(),
      projectId,
      name,
      order,
      collapsed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.sectionRepo.create(section);
    return section;
  }

  /**
   * Delete a section: reassign its tasks to the project's "To Do" section,
   * delete the section, and disable any automation rules that reference it.
   */
  cascadeDelete(sectionId: UUID): void {
    const sectionToDelete = this.sectionRepo.findById(sectionId);
    if (!sectionToDelete) return;

    const defaultSection = this.sectionRepo
      .findByProjectId(sectionToDelete.projectId)
      .find((s) => s.name === 'To Do');

    // Reassign tasks that belong to this section
    const allTasks = this.taskRepo.findAll();
    for (const task of allTasks) {
      if (task.sectionId === sectionId) {
        this.taskRepo.update(task.id, { sectionId: defaultSection?.id || null });
      }
    }

    this.sectionRepo.delete(sectionId);

    // Detect and disable automation rules referencing the deleted section (Req 2.1, 2.2)
    detectBrokenRules(sectionId, sectionToDelete.projectId || '', this.automationRuleRepo);
  }
}
