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
import type { TriggerType, ActionType, RelativeDateOption } from '../schemas';
import type { CardFilter } from '../types';

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

        // Assert: sentence starts with "When a card is"
        expect(sentence).toMatch(/^When a card is /);

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

          // Assert: sentence still starts with "When a card"
          expect(sentence).toMatch(/^When a card /);
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
