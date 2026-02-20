import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildPreviewParts,
  buildPreviewString,
  TRIGGER_META,
  ACTION_META,
  TRIGGER_SECTION_SENTINEL,
  type TriggerConfig,
  type ActionConfig,
  type PreviewPart,
} from './rulePreviewService';
import type { TriggerType, ActionType, RelativeDateOption, CardFilter } from '../../types';

// ============================================================================
// Arbitraries
// ============================================================================

const triggerTypeArb = fc.constantFrom<TriggerType>(
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete'
);

const actionTypeArb = fc.constantFrom<ActionType>(
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date'
);

const relativeDateOptionArb = fc.constantFrom<RelativeDateOption>(
  'today',
  'tomorrow',
  'next_working_day'
);

// Avoid generating section IDs or names that contain "___" to prevent false positives
const sectionIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('___'));
const sectionNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('___'));

// Generate a valid trigger config with all required fields
const validTriggerConfigArb = fc
  .tuple(triggerTypeArb, sectionIdArb)
  .map(([type, sectionId]): TriggerConfig => {
    const meta = TRIGGER_META.find((m) => m.type === type);
    return {
      type,
      sectionId: meta?.needsSection ? sectionId : null,
    };
  });

// Generate a valid action config with all required fields
const validActionConfigArb = fc
  .tuple(actionTypeArb, sectionIdArb, relativeDateOptionArb, fc.constantFrom('top', 'bottom'))
  .map(([type, sectionId, dateOption, position]): ActionConfig => {
    const meta = ACTION_META.find((m) => m.type === type);
    return {
      type,
      sectionId: meta?.needsSection ? sectionId : null,
      dateOption: meta?.needsDateOption ? dateOption : null,
      position: meta?.needsPosition ? position : null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
  });

// Generate a section lookup map that always returns a valid name for any ID
const sectionLookupArb = fc
  .array(fc.tuple(sectionIdArb, sectionNameArb), { minLength: 1, maxLength: 10 })
  .map((entries) => {
    const map = new Map(entries);
    // Return a default section name if the ID is not in the map
    return (id: string) => map.get(id) || `Section-${id.trim() || 'default'}`;
  });

// Generate incomplete trigger config (null type or missing section)
const incompleteTriggerConfigArb = fc.oneof(
  fc.constant<TriggerConfig>({ type: null, sectionId: null }),
  fc
    .constantFrom<TriggerType>('card_moved_into_section', 'card_moved_out_of_section')
    .map((type): TriggerConfig => ({ type, sectionId: null }))
);

// Generate incomplete action config (null type or missing required fields)
const incompleteActionConfigArb = fc.oneof(
  fc.constant<ActionConfig>({ type: null, sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null }),
  fc
    .constantFrom<ActionType>('move_card_to_top_of_section', 'move_card_to_bottom_of_section')
    .map((type): ActionConfig => ({ type, sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null })),
  fc.constant<ActionConfig>({ type: 'set_due_date', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null })
);

// Generate simple card filters for testing
const simpleCardFilterArb = fc.oneof(
  fc.record({ type: fc.constant('has_due_date' as const) }),
  fc.record({ type: fc.constant('no_due_date' as const) }),
  fc.record({ type: fc.constant('is_overdue' as const) }),
  fc.record({ type: fc.constant('due_today' as const) }),
  fc.record({ type: fc.constant('due_tomorrow' as const) })
);

const sectionCardFilterArb = fc.record({
  type: fc.constantFrom('in_section' as const, 'not_in_section' as const),
  sectionId: sectionIdArb,
});

const cardFilterArb = fc.oneof(simpleCardFilterArb, sectionCardFilterArb);

// ============================================================================
// Property Tests
// ============================================================================

describe('rulePreviewService - Property Tests', () => {
  /**
   * Property 7: Preview sentence correctness for all trigger×action combinations
   * **Validates: Requirements 7.1, 7.5**
   */
  it('Property 7: generates non-empty, grammatically correct sentences for all valid trigger×action combinations', () => {
    fc.assert(
      fc.property(validTriggerConfigArb, validActionConfigArb, sectionLookupArb, (trigger, action, sectionLookup) => {
        const parts = buildPreviewParts(trigger, action, sectionLookup);
        const sentence = buildPreviewString(parts);

        // Assert: result is non-empty array
        expect(parts.length).toBeGreaterThan(0);

        // Assert: concatenated string is non-empty
        expect(sentence.trim()).not.toBe('');

        // Assert: contains trigger description
        const triggerMeta = TRIGGER_META.find((m) => m.type === trigger.type);
        if (triggerMeta) {
          if (triggerMeta.needsSection && trigger.sectionId) {
            const sectionName = sectionLookup(trigger.sectionId);
            if (sectionName) {
              expect(sentence).toContain(sectionName);
            }
          }
          // Check for trigger-related keywords
          if (triggerMeta.type === 'card_moved_into_section') {
            expect(sentence).toContain('moved into');
          } else if (triggerMeta.type === 'card_moved_out_of_section') {
            expect(sentence).toContain('moved out of');
          } else if (triggerMeta.type === 'card_marked_complete') {
            expect(sentence).toContain('marked complete');
          } else if (triggerMeta.type === 'card_marked_incomplete') {
            expect(sentence).toContain('marked incomplete');
          } else if (triggerMeta.type === 'section_created') {
            expect(sentence).toMatch(/^When a section is created/);
          } else if (triggerMeta.type === 'section_renamed') {
            expect(sentence).toMatch(/^When a section is renamed/);
          }
        }

        // Assert: contains action description
        const actionMeta = ACTION_META.find((m) => m.type === action.type);
        if (actionMeta) {
          if (actionMeta.needsSection && action.sectionId) {
            const sectionName = sectionLookup(action.sectionId);
            if (sectionName) {
              expect(sentence).toContain(sectionName);
            }
          }
          // Check for action-related keywords
          if (actionMeta.type === 'move_card_to_top_of_section' || actionMeta.type === 'move_card_to_bottom_of_section') {
            expect(sentence).toContain('move to');
          } else if (actionMeta.type === 'mark_card_complete') {
            expect(sentence).toContain('mark as complete');
          } else if (actionMeta.type === 'mark_card_incomplete') {
            expect(sentence).toContain('mark as incomplete');
          } else if (actionMeta.type === 'set_due_date') {
            expect(sentence).toContain('set due date');
          } else if (actionMeta.type === 'remove_due_date') {
            expect(sentence).toContain('remove due date');
          }
        }

        // Assert: sentence starts with "When a card is" or "When a section is"
        expect(sentence).toMatch(/^When a (card|section) is /);

        // Assert: sentence contains the separator ", "
        expect(sentence).toContain(', ');

        // Assert: no double underscores (indicates incomplete config)
        expect(sentence).not.toContain('___');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Preview shows placeholders for incomplete configuration
   * **Validates: Requirements 7.2**
   */
  it('Property 8: shows underscore placeholders for incomplete trigger or action configuration', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Case 1: Incomplete trigger, valid action
          fc.tuple(incompleteTriggerConfigArb, validActionConfigArb),
          // Case 2: Valid trigger, incomplete action
          fc.tuple(validTriggerConfigArb, incompleteActionConfigArb),
          // Case 3: Both incomplete
          fc.tuple(incompleteTriggerConfigArb, incompleteActionConfigArb)
        ),
        sectionLookupArb,
        ([trigger, action], sectionLookup) => {
          const parts = buildPreviewParts(trigger, action, sectionLookup);
          const sentence = buildPreviewString(parts);

          // Assert: result is non-empty array
          expect(parts.length).toBeGreaterThan(0);

          // Assert: concatenated string contains underscore placeholders
          expect(sentence).toContain('___');

          // Assert: at least one part has type 'value' with '___' content
          const hasPlaceholder = parts.some((p) => p.type === 'value' && p.content === '___');
          expect(hasPlaceholder).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19: Rule preview includes filter descriptions
   * **Validates: Requirements 11.3**
   */
  it('Property 19: includes filter descriptions in preview when filters are provided', () => {
    fc.assert(
      fc.property(
        validTriggerConfigArb,
        validActionConfigArb,
        sectionLookupArb,
        fc.array(cardFilterArb, { minLength: 1, maxLength: 3 }),
        (trigger, action, sectionLookup, filters) => {
          const parts = buildPreviewParts(trigger, action, sectionLookup, filters);
          const sentence = buildPreviewString(parts);

          // Assert: result is non-empty
          expect(parts.length).toBeGreaterThan(0);
          expect(sentence.trim()).not.toBe('');

          // Assert: sentence contains filter-related text
          // Check for common filter keywords based on filter types
          const hasFilterKeywords = filters.some((filter) => {
            if (filter.type === 'has_due_date') {
              return sentence.includes('with a due date');
            } else if (filter.type === 'no_due_date') {
              return sentence.includes('without a due date');
            } else if (filter.type === 'is_overdue') {
              return sentence.includes('that is overdue');
            } else if (filter.type === 'due_today') {
              return sentence.includes('due today');
            } else if (filter.type === 'due_tomorrow') {
              return sentence.includes('due tomorrow');
            } else if (filter.type === 'in_section' || filter.type === 'not_in_section') {
              return sentence.includes('in "') || sentence.includes('not in "');
            }
            return false;
          });

          expect(hasFilterKeywords).toBe(true);

          // Assert: sentence still starts with "When a card" or "When a section"
          expect(sentence).toMatch(/^When a (card|section) /);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: Preview without filters works as before
   */
  it('generates preview without filters when filters parameter is omitted', () => {
    const trigger: TriggerConfig = {
      type: 'card_moved_into_section',
      sectionId: 'section-1',
    };
    const action: ActionConfig = {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
    const sectionLookup = (id: string) => (id === 'section-1' ? 'Done' : undefined);

    const parts = buildPreviewParts(trigger, action, sectionLookup);
    const sentence = buildPreviewString(parts);

    expect(sentence).toBe('When a card is moved into Done, mark as complete');
  });

  /**
   * Unit test: Preview with filters includes filter descriptions
   */
  it('generates preview with filter descriptions when filters are provided', () => {
    const trigger: TriggerConfig = {
      type: 'card_moved_into_section',
      sectionId: 'section-archive',
    };
    const action: ActionConfig = {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
    const filters: CardFilter[] = [
      { type: 'in_section', sectionId: 'section-done' },
      { type: 'has_due_date' },
    ];
    const sectionLookup = (id: string) => {
      if (id === 'section-archive') return 'Archive';
      if (id === 'section-done') return 'Done';
      return undefined;
    };

    const parts = buildPreviewParts(trigger, action, sectionLookup, filters);
    const sentence = buildPreviewString(parts);

    expect(sentence).toContain('in "Done"');
    expect(sentence).toContain('with a due date');
    expect(sentence).toContain('moved into Archive');
    expect(sentence).toContain('mark as complete');
  });

  /**
   * Unit test: Preview with trigger section sentinel shows "the triggering section"
   */
  it('shows "the triggering section" when action sectionId is the trigger sentinel', () => {
    const trigger: TriggerConfig = {
      type: 'section_created',
      sectionId: null,
    };
    const action: ActionConfig = {
      type: 'create_card',
      sectionId: TRIGGER_SECTION_SENTINEL,
      dateOption: null,
      position: null,
      cardTitle: 'Standup Notes',
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
    const sectionLookup = () => undefined;

    const parts = buildPreviewParts(trigger, action, sectionLookup);
    const sentence = buildPreviewString(parts);

    expect(sentence).toContain('the triggering section');
    expect(sentence).toContain('Standup Notes');
  });
});

// ============================================================================
// isDuplicateRule Tests
// ============================================================================

import { isDuplicateRule } from './rulePreviewService';

describe('isDuplicateRule - Unit Tests', () => {
  const makeRule = (overrides: Partial<{
    id: string;
    enabled: boolean;
    triggerType: string;
    triggerSectionId: string | null;
    actionType: string;
    actionSectionId: string | null;
  }> = {}) => ({
    id: overrides.id ?? 'rule-1',
    enabled: overrides.enabled ?? true,
    trigger: {
      type: overrides.triggerType ?? 'card_moved_into_section',
      sectionId: overrides.triggerSectionId ?? 'section-1',
    },
    action: {
      type: overrides.actionType ?? 'mark_card_complete',
      sectionId: overrides.actionSectionId ?? null,
    },
  });

  it('returns true when an existing enabled rule matches all four fields', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(true);
  });

  it('returns false when trigger type differs', () => {
    const trigger: TriggerConfig = { type: 'card_marked_complete', sectionId: null };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('returns false when trigger sectionId differs', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-2' };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('returns false when action type differs', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'mark_card_incomplete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('returns false when action sectionId differs', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'move_card_to_top_of_section', sectionId: 'section-3', dateOption: null, position: 'top', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule({ actionType: 'move_card_to_top_of_section', actionSectionId: 'section-2' })];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('ignores disabled rules', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule({ enabled: false })];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('excludes the rule being edited', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule({ id: 'rule-edit' })];

    expect(isDuplicateRule(trigger, action, existing, 'rule-edit')).toBe(false);
  });

  it('returns false when trigger type is null', () => {
    const trigger: TriggerConfig = { type: null, sectionId: null };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('returns false when action type is null', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: null, sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };
    const existing = [makeRule()];

    expect(isDuplicateRule(trigger, action, existing)).toBe(false);
  });

  it('returns false with empty existing rules', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const action: ActionConfig = { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null };

    expect(isDuplicateRule(trigger, action, [])).toBe(false);
  });
});

describe('isDuplicateRule - Property-Based Tests', () => {
  const triggerTypeArb2 = fc.constantFrom<TriggerType>(
    'card_moved_into_section',
    'card_moved_out_of_section',
    'card_marked_complete',
    'card_marked_incomplete',
    'card_created_in_section',
  );

  const actionTypeArb2 = fc.constantFrom<ActionType>(
    'move_card_to_top_of_section',
    'move_card_to_bottom_of_section',
    'mark_card_complete',
    'mark_card_incomplete',
    'set_due_date',
    'remove_due_date',
  );

  const sectionIdOrNullArb = fc.oneof(
    fc.constant(null as string | null),
    fc.string({ minLength: 1, maxLength: 20 }),
  );

  /**
   * Property 13: Duplicate rule detection
   * For any two rules in the same project with identical trigger type, trigger sectionId,
   * action type, and action sectionId, the duplicate detection function SHALL return true.
   * For rules differing in any of these four fields, it SHALL return false.
   *
   * **Validates: Requirements 11.1**
   */
  it('Property 13: detects duplicates iff all four fields match on an enabled rule', () => {
    fc.assert(
      fc.property(
        triggerTypeArb2,
        sectionIdOrNullArb,
        actionTypeArb2,
        sectionIdOrNullArb,
        triggerTypeArb2,
        sectionIdOrNullArb,
        actionTypeArb2,
        sectionIdOrNullArb,
        (tType, tSec, aType, aSec, eTType, eTSec, eAType, eASec) => {
          const trigger: TriggerConfig = { type: tType, sectionId: tSec };
          const action: ActionConfig = {
            type: aType, sectionId: aSec, dateOption: null, position: null,
            cardTitle: null, cardDateOption: null, specificMonth: null,
            specificDay: null, monthTarget: null,
          };
          const existingRule = {
            id: 'existing-1',
            enabled: true,
            trigger: { type: eTType, sectionId: eTSec },
            action: { type: eAType, sectionId: eASec },
          };

          const result = isDuplicateRule(trigger, action, [existingRule]);

          const allMatch =
            tType === eTType &&
            tSec === eTSec &&
            aType === eAType &&
            aSec === eASec;

          expect(result).toBe(allMatch);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 13b: disabled rules are never considered duplicates', () => {
    fc.assert(
      fc.property(
        triggerTypeArb2,
        sectionIdOrNullArb,
        actionTypeArb2,
        sectionIdOrNullArb,
        (tType, tSec, aType, aSec) => {
          const trigger: TriggerConfig = { type: tType, sectionId: tSec };
          const action: ActionConfig = {
            type: aType, sectionId: aSec, dateOption: null, position: null,
            cardTitle: null, cardDateOption: null, specificMonth: null,
            specificDay: null, monthTarget: null,
          };
          // Same fields but disabled
          const existingRule = {
            id: 'existing-1',
            enabled: false,
            trigger: { type: tType, sectionId: tSec },
            action: { type: aType, sectionId: aSec },
          };

          expect(isDuplicateRule(trigger, action, [existingRule])).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Scheduled Trigger Preview Tests ────────────────────────────────────

import { describeSchedule, computeNextRunDescription } from './rulePreviewService';

describe('describeSchedule', () => {
  it('interval: formats minutes', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { kind: 'interval', intervalMinutes: 30 } }))
      .toBe('30 minutes');
  });

  it('interval: formats hours', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { kind: 'interval', intervalMinutes: 120 } }))
      .toBe('2 hours');
  });

  it('interval: formats days', () => {
    expect(describeSchedule({ type: 'scheduled_interval', schedule: { kind: 'interval', intervalMinutes: 1440 } }))
      .toBe('1 day');
  });

  it('cron: daily at time', () => {
    expect(describeSchedule({
      type: 'scheduled_cron',
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] },
    })).toBe('day at 09:00');
  });

  it('cron: weekly with days', () => {
    expect(describeSchedule({
      type: 'scheduled_cron',
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 5], daysOfMonth: [] },
    })).toBe('Mon, Fri at 09:00');
  });

  it('cron: monthly with day of month', () => {
    expect(describeSchedule({
      type: 'scheduled_cron',
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1] },
    })).toBe('1st of month at 09:00');
  });

  it('due-date-relative: before', () => {
    expect(describeSchedule({
      type: 'scheduled_due_date_relative',
      schedule: { kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' },
    })).toBe('1 day before due date');
  });

  it('due-date-relative: after', () => {
    expect(describeSchedule({
      type: 'scheduled_due_date_relative',
      schedule: { kind: 'due_date_relative', offsetMinutes: 2880, displayUnit: 'days' },
    })).toBe('2 days after due date');
  });
});

// Feature: scheduled-triggers-phase-5a, Property 19: Scheduled trigger description format
describe('Property 19: Scheduled trigger description format', () => {
  it('scheduled preview starts with "Every", event preview starts with "When"', () => {
    const sectionLookup = () => 'My Section';

    // Scheduled trigger
    const scheduledParts = buildPreviewParts(
      { type: 'scheduled_interval', sectionId: null },
      { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      sectionLookup
    );
    const scheduledStr = scheduledParts.map((p) => p.content).join('');
    expect(scheduledStr.startsWith('Every')).toBe(true);

    // Event trigger
    const eventParts = buildPreviewParts(
      { type: 'card_moved_into_section', sectionId: 'sec-1' },
      { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      sectionLookup
    );
    const eventStr = eventParts.map((p) => p.content).join('');
    expect(eventStr.startsWith('When')).toBe(true);
  });
});

describe('computeNextRunDescription', () => {
  const NOW = new Date('2026-02-19T10:00:00.000Z').getTime();

  it('interval: shows relative time until next run', () => {
    const trigger = {
      type: 'scheduled_interval',
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: new Date(NOW - 10 * 60_000).toISOString(), // 10 min ago
    };
    const desc = computeNextRunDescription(trigger, NOW);
    expect(desc).toBe('in 20 min');
  });

  it('interval: shows "On next tick" when overdue', () => {
    const trigger = {
      type: 'scheduled_interval',
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: new Date(NOW - 60 * 60_000).toISOString(), // 60 min ago
    };
    expect(computeNextRunDescription(trigger, NOW)).toBe('On next tick');
  });

  it('due-date-relative: shows "Checks on next tick"', () => {
    const trigger = {
      type: 'scheduled_due_date_relative',
      schedule: { kind: 'due_date_relative', offsetMinutes: -1440 },
    };
    expect(computeNextRunDescription(trigger, NOW)).toBe('Checks on next tick');
  });
});


// ============================================================================
// Feature: scheduled-triggers-phase-5c — One-time trigger descriptions
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
// ============================================================================

describe('describeSchedule — scheduled_one_time', () => {
  it('formats fireAt as "On Mon DD, YYYY at HH:MM"', () => {
    const desc = describeSchedule({
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
    });
    expect(desc).toBe('On Mar 15, 2025 at 15:00');
  });

  it('formats a different date correctly', () => {
    const desc = describeSchedule({
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt: '2025-12-25T09:30:00.000Z' },
    });
    expect(desc).toBe('On Dec 25, 2025 at 09:30');
  });

  it('formats midnight correctly', () => {
    const desc = describeSchedule({
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt: '2025-01-01T00:00:00.000Z' },
    });
    expect(desc).toBe('On Jan 1, 2025 at 00:00');
  });
});

describe('buildPreviewParts — scheduled_one_time preview sentence', () => {
  it('uses "On" prefix instead of "Every" for one-time triggers', () => {
    const trigger: TriggerConfig = {
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
    };
    const action: ActionConfig = {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
    const sectionLookup = () => undefined;

    const parts = buildPreviewParts(trigger, action, sectionLookup);
    const sentence = buildPreviewString(parts);

    expect(sentence).toMatch(/^On /);
    expect(sentence).not.toMatch(/^Every /);
    expect(sentence).toContain('On Mar 15, 2025 at 15:00');
    expect(sentence).toContain('mark as complete');
  });

  it('includes filters in one-time preview sentence', () => {
    const trigger: TriggerConfig = {
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
    };
    const action: ActionConfig = {
      type: 'move_card_to_bottom_of_section',
      sectionId: 'section-archive',
      dateOption: null,
      position: 'bottom',
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };
    const filters: CardFilter[] = [{ type: 'is_overdue' }];
    const sectionLookup = (id: string) => (id === 'section-archive' ? 'Archive' : undefined);

    const parts = buildPreviewParts(trigger, action, sectionLookup, filters);
    const sentence = buildPreviewString(parts);

    expect(sentence).toMatch(/^On Mar 15, 2025 at 15:00, for cards/);
    expect(sentence).toContain('that is overdue');
    expect(sentence).toContain('move to bottom of Archive');
  });
});

describe('computeNextRunDescription — scheduled_one_time', () => {
  it('enabled one-time: shows "Fires on [date] (in N days)"', () => {
    const fireAt = '2025-03-15T15:00:00.000Z';
    const nowMs = new Date('2025-03-10T10:00:00.000Z').getTime(); // 5 days before
    const trigger = {
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt },
      lastEvaluatedAt: null,
    };
    const desc = computeNextRunDescription(trigger, nowMs);
    expect(desc).toBe('Fires on Mar 15, 2025 (in 5 days)');
  });

  it('enabled one-time firing today: shows "Fires today at HH:MM"', () => {
    const fireAt = '2025-03-15T15:00:00.000Z';
    const nowMs = new Date('2025-03-15T10:00:00.000Z').getTime(); // same day
    const trigger = {
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt },
      lastEvaluatedAt: null,
    };
    const desc = computeNextRunDescription(trigger, nowMs);
    expect(desc).toBe('Fires today at 15:00');
  });

  it('fired (disabled) one-time: shows "Fired on [date]"', () => {
    const fireAt = '2025-03-15T15:00:00.000Z';
    const nowMs = new Date('2025-03-20T10:00:00.000Z').getTime(); // after fire
    const trigger = {
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt },
      lastEvaluatedAt: '2025-03-15T15:00:01.000Z', // was evaluated (fired)
    };
    // For fired one-time, the rule is disabled. We pass enabled=false context.
    const desc = computeNextRunDescription(trigger, nowMs, false);
    expect(desc).toBe('Fired on Mar 15, 2025');
  });

  it('enabled one-time with 1 day remaining', () => {
    const fireAt = '2025-03-15T15:00:00.000Z';
    const nowMs = new Date('2025-03-14T10:00:00.000Z').getTime();
    const trigger = {
      type: 'scheduled_one_time',
      schedule: { kind: 'one_time', fireAt },
      lastEvaluatedAt: null,
    };
    const desc = computeNextRunDescription(trigger, nowMs);
    expect(desc).toBe('Fires on Mar 15, 2025 (in 1 day)');
  });
});
