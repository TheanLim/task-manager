import type { Repository } from '@/lib/repositories/types';
import type { AutomationRule } from '../types';

/**
 * Repository interface for automation rules.
 * Extends the base Repository interface with project-scoped querying.
 *
 * Validates Requirements: 2.1, 2.2
 */
export interface AutomationRuleRepository extends Repository<AutomationRule> {
  /**
   * Find all automation rules scoped to a specific project.
   * Excludes global rules (projectId === null).
   */
  findByProjectId(projectId: string): AutomationRule[];

  /**
   * Find all global rules (projectId === null).
   * Global rules apply across all projects.
   */
  findGlobal(): AutomationRule[];
}
