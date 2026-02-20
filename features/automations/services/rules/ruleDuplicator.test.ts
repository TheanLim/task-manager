import { describe, it, expect } from 'vitest';
import { duplicateRuleToProject } from './ruleDuplicator';
import type { AutomationRule } from '../../types';
import type { Section } from '@/lib/schemas';

const NOW = '2025-01-01T00:00:00.000Z';

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    projectId: 'proj-source',
    name: 'My Rule',
    trigger: { type: 'card_moved_into_section', sectionId: null },
    filters: [],
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 5,
    lastExecutedAt: NOW,
    recentExecutions: [
      { timestamp: NOW, triggerDescription: 'test', actionDescription: 'test', taskName: 'task' },
    ],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSection(id: string, projectId: string, name: string): Section {
  return {
    id,
    projectId,
    name,
    order: 0,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('duplicateRuleToProject', () => {
  const sourceSections = [
    makeSection('src-todo', 'proj-source', 'To Do'),
    makeSection('src-done', 'proj-source', 'Done'),
    makeSection('src-review', 'proj-source', 'Review'),
  ];

  const targetSections = [
    makeSection('tgt-todo', 'proj-target', 'To Do'),
    makeSection('tgt-done', 'proj-target', 'Done'),
  ];

  it('creates a new rule with unique ID and target projectId', () => {
    const rule = makeRule();
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.id).not.toBe(rule.id);
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.projectId).toBe('proj-target');
  });

  it('sets name to "Copy of [original name]"', () => {
    const rule = makeRule({ name: 'Move to Done' });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.name).toBe('Copy of Move to Done');
  });

  it('sets enabled to false', () => {
    const rule = makeRule({ enabled: true });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.enabled).toBe(false);
  });

  it('remaps trigger sectionId by matching section name', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'src-todo' },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.trigger.sectionId).toBe('tgt-todo');
    expect(result.brokenReason).toBeNull();
  });

  it('remaps action sectionId by matching section name', () => {
    const rule = makeRule({
      action: {
        type: 'move_card_to_bottom_of_section',
        sectionId: 'src-done',
        dateOption: null,
        position: 'bottom',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.action.sectionId).toBe('tgt-done');
    expect(result.brokenReason).toBeNull();
  });

  it('remaps filter sectionIds by matching section name', () => {
    const rule = makeRule({
      filters: [
        { type: 'in_section', sectionId: 'src-todo' },
        { type: 'not_in_section', sectionId: 'src-done' },
      ],
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.filters).toEqual([
      { type: 'in_section', sectionId: 'tgt-todo' },
      { type: 'not_in_section', sectionId: 'tgt-done' },
    ]);
    expect(result.brokenReason).toBeNull();
  });

  it('sets brokenReason when trigger section name has no match in target', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'src-review' },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.brokenReason).toBe('section_deleted');
  });

  it('sets brokenReason when action section name has no match in target', () => {
    const rule = makeRule({
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'src-review',
        dateOption: null,
        position: 'top',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.brokenReason).toBe('section_deleted');
  });

  it('sets brokenReason when filter section name has no match in target', () => {
    const rule = makeRule({
      filters: [{ type: 'in_section', sectionId: 'src-review' }],
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.brokenReason).toBe('section_deleted');
  });

  it('preserves non-section filters unchanged', () => {
    const rule = makeRule({
      filters: [
        { type: 'has_due_date' },
        { type: 'is_overdue' },
      ],
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.filters).toEqual([
      { type: 'has_due_date' },
      { type: 'is_overdue' },
    ]);
    expect(result.brokenReason).toBeNull();
  });

  it('handles null sectionIds without breaking', () => {
    const rule = makeRule({
      trigger: { type: 'card_marked_complete', sectionId: null },
      action: {
        type: 'mark_card_complete',
        sectionId: null,
        dateOption: null,
        position: null,
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.trigger.sectionId).toBeNull();
    expect(result.action.sectionId).toBeNull();
    expect(result.brokenReason).toBeNull();
  });

  it('resets executionCount, lastExecutedAt, and recentExecutions', () => {
    const rule = makeRule({
      executionCount: 10,
      lastExecutedAt: NOW,
      recentExecutions: [
        { timestamp: NOW, triggerDescription: 'x', actionDescription: 'y', taskName: 'z' },
      ],
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.executionCount).toBe(0);
    expect(result.lastExecutedAt).toBeNull();
    expect(result.recentExecutions).toEqual([]);
  });

  it('uses case-sensitive section name matching', () => {
    const source = [makeSection('src-1', 'proj-source', 'todo')];
    const target = [makeSection('tgt-1', 'proj-target', 'Todo')]; // different case

    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'src-1' },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', source, target);

    expect(result.brokenReason).toBe('section_deleted');
  });

  it('handles empty source and target sections', () => {
    const rule = makeRule({
      trigger: { type: 'card_marked_complete', sectionId: null },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', [], []);

    expect(result.projectId).toBe('proj-target');
    expect(result.brokenReason).toBeNull();
  });

  it('marks broken when source section ID not found in source sections list', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'nonexistent-src' },
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.brokenReason).toBe('section_deleted');
  });

  it('sets fresh createdAt and updatedAt timestamps', () => {
    const rule = makeRule({
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-06-01T00:00:00.000Z',
    });
    const result = duplicateRuleToProject(rule, 'proj-target', sourceSections, targetSections);

    expect(result.createdAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(result.updatedAt).not.toBe('2020-06-01T00:00:00.000Z');
    expect(result.createdAt).toBe(result.updatedAt);
  });
});


// --- Arbitraries for property-based tests ---
import * as fc from 'fast-check';

const sectionNameArb = fc.stringMatching(/^[A-Za-z ]{1,20}$/);

/** Generate a section with a given name and project-scoped ID */
const sectionArb = (projectId: string, name: string, index: number) =>
  fc.constant(
    makeSection(`${projectId}-sec-${index}`, projectId, name),
  );

/**
 * Generate source sections and target sections where some names overlap and some don't.
 * Returns { sourceSections, targetSections, sharedNames, sourceOnlyNames }
 */
const sectionPairArb = fc.tuple(
  // shared section names (exist in both projects)
  fc.array(sectionNameArb, { minLength: 0, maxLength: 4 }),
  // source-only section names (no match in target)
  fc.array(sectionNameArb, { minLength: 0, maxLength: 3 }),
  // target-only section names (extra sections in target, not referenced by source rule)
  fc.array(sectionNameArb, { minLength: 0, maxLength: 2 }),
).map(([shared, sourceOnly, targetOnly]) => {
  // Deduplicate names across all groups
  const seen = new Set<string>();
  const dedup = (names: string[]) =>
    names.filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

  const sharedNames = dedup(shared);
  const sourceOnlyNames = dedup(sourceOnly);
  const targetOnlyNames = dedup(targetOnly);

  const sourceSections = [
    ...sharedNames.map((name, i) => makeSection(`src-sec-${i}`, 'proj-source', name)),
    ...sourceOnlyNames.map((name, i) =>
      makeSection(`src-only-${i}`, 'proj-source', name),
    ),
  ];

  const targetSections = [
    ...sharedNames.map((name, i) => makeSection(`tgt-sec-${i}`, 'proj-target', name)),
    ...targetOnlyNames.map((name, i) =>
      makeSection(`tgt-only-${i}`, 'proj-target', name),
    ),
  ];

  return { sourceSections, targetSections, sharedNames, sourceOnlyNames };
});

/** Build a trigger arbitrary that references section IDs from the given sections */
const triggerArb = (sectionIds: string[]) =>
  fc.record({
    type: fc.constantFrom(
      'card_moved_into_section' as const,
      'card_moved_out_of_section' as const,
      'card_marked_complete' as const,
      'card_marked_incomplete' as const,
      'card_created_in_section' as const,
      'section_created' as const,
      'section_renamed' as const,
    ),
    sectionId: sectionIds.length > 0
      ? fc.oneof(fc.constant(null), fc.constantFrom(...sectionIds))
      : fc.constant(null),
  });

const actionArb = (sectionIds: string[]) =>
  fc.record({
    type: fc.constantFrom(
      'move_card_to_top_of_section' as const,
      'move_card_to_bottom_of_section' as const,
      'mark_card_complete' as const,
      'mark_card_incomplete' as const,
      'set_due_date' as const,
      'remove_due_date' as const,
      'create_card' as const,
    ),
    sectionId: sectionIds.length > 0
      ? fc.oneof(fc.constant(null), fc.constantFrom(...sectionIds))
      : fc.constant(null),
    dateOption: fc.constant(null),
    position: fc.constant(null),
    cardTitle: fc.constant(null),
    cardDateOption: fc.constant(null),
    specificMonth: fc.constant(null),
    specificDay: fc.constant(null),
    monthTarget: fc.constant(null),
  });

const sectionFilterArb = (sectionIds: string[]) =>
  fc.oneof(
    fc.record({
      type: fc.constant('in_section' as const),
      sectionId: fc.constantFrom(...sectionIds),
    }),
    fc.record({
      type: fc.constant('not_in_section' as const),
      sectionId: fc.constantFrom(...sectionIds),
    }),
  );

const nonSectionFilterArb = fc.constantFrom(
  { type: 'has_due_date' as const },
  { type: 'no_due_date' as const },
  { type: 'is_overdue' as const },
);

const filtersArb = (sectionIds: string[]) =>
  sectionIds.length > 0
    ? fc.array(
        fc.oneof(sectionFilterArb(sectionIds), nonSectionFilterArb),
        { minLength: 0, maxLength: 4 },
      )
    : fc.array(nonSectionFilterArb, { minLength: 0, maxLength: 2 });

const ruleWithSectionsArb = (sourceSectionIds: string[]) =>
  fc.tuple(
    triggerArb(sourceSectionIds),
    actionArb(sourceSectionIds),
    filtersArb(sourceSectionIds),
    fc.stringMatching(/^[A-Za-z0-9 ]{1,30}$/),
  ).map(([trigger, action, filters, name]) =>
    makeRule({
      id: `rule-${Math.random().toString(36).slice(2, 10)}`,
      projectId: 'proj-source',
      name,
      trigger,
      action,
      filters,
      enabled: true,
      brokenReason: null,
    }),
  );

describe('Property 9: Cross-project duplication with section remapping', () => {
  /**
   * **Validates: Requirements 7.4, 7.5, 7.6, 7.7**
   *
   * For any automation rule and for any target project, duplicating the rule
   * to the target project SHALL produce a new rule with:
   * (a) a unique ID different from the original,
   * (b) projectId equal to the target project's ID,
   * (c) name equal to "Copy of [original name]",
   * (d) enabled set to false.
   * Section references SHALL be remapped by matching section names:
   * if a matching section name exists in the target project, the new rule
   * uses the target section's ID; if no match exists, the rule's brokenReason
   * SHALL be set to 'section_deleted'.
   */
  it('duplicated rule has correct identity, name, disabled state, and section remapping', () => {
    fc.assert(
      fc.property(
        sectionPairArb.chain(({ sourceSections, targetSections, sharedNames, sourceOnlyNames }) => {
          const sourceSectionIds = sourceSections.map((s) => s.id);
          return ruleWithSectionsArb(sourceSectionIds).map((rule) => ({
            rule,
            sourceSections,
            targetSections,
            sharedNames,
            sourceOnlyNames,
          }));
        }),
        ({ rule, sourceSections, targetSections, sharedNames, sourceOnlyNames }) => {
          const targetProjectId = 'proj-target';
          const result = duplicateRuleToProject(rule, targetProjectId, sourceSections, targetSections);

          // Build lookup maps for verification
          const sourceIdToName = new Map(sourceSections.map((s) => [s.id, s.name]));
          const targetNameToId = new Map<string, string>();
          for (const s of targetSections) {
            if (!targetNameToId.has(s.name)) targetNameToId.set(s.name, s.id);
          }

          // (a) Unique ID different from original
          expect(result.id).not.toBe(rule.id);
          expect(result.id.length).toBeGreaterThan(0);

          // (b) projectId equals target
          expect(result.projectId).toBe(targetProjectId);

          // (c) Name is "Copy of [original name]"
          expect(result.name).toBe(`Copy of ${rule.name}`);

          // (d) Enabled is false
          expect(result.enabled).toBe(false);

          // Section remapping verification
          let expectBroken = false;

          // Check trigger sectionId remapping
          if (rule.trigger.sectionId !== null) {
            const sourceName = sourceIdToName.get(rule.trigger.sectionId);
            if (sourceName === undefined || !targetNameToId.has(sourceName)) {
              expectBroken = true;
            } else {
              expect(result.trigger.sectionId).toBe(targetNameToId.get(sourceName));
            }
          } else {
            expect(result.trigger.sectionId).toBeNull();
          }

          // Check action sectionId remapping
          if (rule.action.sectionId !== null) {
            const sourceName = sourceIdToName.get(rule.action.sectionId);
            if (sourceName === undefined || !targetNameToId.has(sourceName)) {
              expectBroken = true;
            } else {
              expect(result.action.sectionId).toBe(targetNameToId.get(sourceName));
            }
          } else {
            expect(result.action.sectionId).toBeNull();
          }

          // Check filter sectionId remapping
          for (let i = 0; i < rule.filters.length; i++) {
            const filter = rule.filters[i];
            const resultFilter = result.filters[i];
            if (filter.type === 'in_section' || filter.type === 'not_in_section') {
              const sourceName = sourceIdToName.get(filter.sectionId);
              if (sourceName === undefined || !targetNameToId.has(sourceName)) {
                expectBroken = true;
              } else {
                expect((resultFilter as any).sectionId).toBe(targetNameToId.get(sourceName));
              }
            }
          }

          // brokenReason check
          if (expectBroken) {
            expect(result.brokenReason).toBe('section_deleted');
          } else {
            expect(result.brokenReason).toBeNull();
          }

          // Execution state is reset
          expect(result.recentExecutions).toEqual([]);
          expect(result.executionCount).toBe(0);
          expect(result.lastExecutedAt).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});

