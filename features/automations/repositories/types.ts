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
   *
   * @param projectId - The project ID to filter by
   * @returns Array of automation rules belonging to the project
   */
  findByProjectId(projectId: string): AutomationRule[];
}
