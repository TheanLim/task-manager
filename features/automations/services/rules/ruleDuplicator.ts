import { v4 as uuidv4 } from 'uuid';
import type { AutomationRule } from '../../types';
import type { Section } from '@/lib/schemas';

/**
 * Builds a lookup map from section ID → section name using the source sections,
 * and a reverse map from section name → section ID using the target sections.
 */
function buildSectionMaps(
  sourceSections: Section[],
  targetSections: Section[],
): { sourceIdToName: Map<string, string>; targetNameToId: Map<string, string> } {
  const sourceIdToName = new Map<string, string>();
  for (const s of sourceSections) {
    sourceIdToName.set(s.id, s.name);
  }

  const targetNameToId = new Map<string, string>();
  for (const s of targetSections) {
    // First match wins — consistent with case-sensitive name matching
    if (!targetNameToId.has(s.name)) {
      targetNameToId.set(s.name, s.id);
    }
  }

  return { sourceIdToName, targetNameToId };
}

/**
 * Remaps a single section ID from source to target project by matching section names.
 * Returns the target section ID if a match is found, or null if no match exists.
 */
function remapSectionId(
  sectionId: string | null,
  sourceIdToName: Map<string, string>,
  targetNameToId: Map<string, string>,
): { id: string | null; broken: boolean } {
  if (sectionId === null) return { id: null, broken: false };

  const name = sourceIdToName.get(sectionId);
  if (name === undefined) return { id: sectionId, broken: true };

  const targetId = targetNameToId.get(name);
  if (targetId === undefined) return { id: sectionId, broken: true };

  return { id: targetId, broken: false };
}

/**
 * Duplicates an automation rule to a target project with section name remapping.
 *
 * Creates a new rule with:
 * - A unique ID
 * - The target project's ID
 * - Name "Copy of [original name]"
 * - enabled: false
 * - Section references remapped by matching section names (case-sensitive)
 * - brokenReason set to 'section_deleted' if any section name doesn't match
 *
 * Validates: Requirements 7.4, 7.5, 7.6, 7.7
 *
 * @param rule - The source automation rule to duplicate
 * @param targetProjectId - The project ID to duplicate into
 * @param sourceSections - Sections from the source project (for name lookup)
 * @param targetSections - Sections from the target project (for name matching)
 * @returns A new AutomationRule for the target project
 */
export function duplicateRuleToProject(
  rule: AutomationRule,
  targetProjectId: string,
  sourceSections: Section[],
  targetSections: Section[],
): AutomationRule {
  const { sourceIdToName, targetNameToId } = buildSectionMaps(sourceSections, targetSections);
  const now = new Date().toISOString();
  let broken = false;

  // Remap trigger sectionId
  const triggerRemap = remapSectionId(rule.trigger.sectionId, sourceIdToName, targetNameToId);
  if (triggerRemap.broken) broken = true;

  // Remap action sectionId
  const actionRemap = remapSectionId(rule.action.sectionId, sourceIdToName, targetNameToId);
  if (actionRemap.broken) broken = true;

  // Remap filter sectionIds
  const remappedFilters = rule.filters.map((filter) => {
    if (filter.type === 'in_section' || filter.type === 'not_in_section') {
      const filterRemap = remapSectionId(filter.sectionId, sourceIdToName, targetNameToId);
      if (filterRemap.broken) broken = true;
      return { ...filter, sectionId: filterRemap.id ?? filter.sectionId };
    }
    return { ...filter };
  });

  return {
    ...rule,
    id: uuidv4(),
    projectId: targetProjectId,
    name: `Copy of ${rule.name}`,
    enabled: false,
    brokenReason: broken ? 'section_deleted' : null,
    trigger: { ...rule.trigger, sectionId: triggerRemap.id } as any,
    action: { ...rule.action, sectionId: actionRemap.id } as any,
    filters: remappedFilters,
    recentExecutions: [],
    executionCount: 0,
    lastExecutedAt: null,
    bulkPausedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
