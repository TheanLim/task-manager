import { describe, it, expect } from 'vitest';
import { buildRuleUpdates, buildNewRuleData } from './ruleSaveService';
import type { AutomationRule } from '../../types';
import type { Section } from '@/lib/schemas';
import type { TriggerConfig, ActionConfig } from '../preview/rulePreviewService';

const sections: Section[] = [
  { id: 's1', projectId: 'p1', name: 'To Do', order: 0, collapsed: false, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 's2', projectId: 'p1', name: 'Done', order: 1, collapsed: false, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
];

const baseTrigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 's1' };
const baseAction: ActionConfig = {
  type: 'move_card_to_top_of_section',
  sectionId: 's2',
  dateOption: null,
  position: 'top',
  cardTitle: null,
  cardDateOption: null,
  specificMonth: null,
  specificDay: null,
  monthTarget: null,
};

const editingRule: AutomationRule = {
  id: 'r1',
  projectId: 'p1',
  name: 'Old name',
  trigger: { type: 'card_moved_into_section', sectionId: 's1' },
  filters: [],
  action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
  enabled: true,
  brokenReason: null,
  executionCount: 3,
  lastExecutedAt: '2025-01-01T00:00:00.000Z',
  recentExecutions: [],
  order: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  bulkPausedAt: null,
};

describe('buildRuleUpdates', () => {
  it('uses provided rule name when non-empty', () => {
    const result = buildRuleUpdates({
      trigger: baseTrigger, filters: [], action: baseAction,
      ruleName: 'My Rule', sections, editingRule,
    });
    expect(result.name).toBe('My Rule');
  });

  it('auto-generates name from preview when ruleName is blank', () => {
    const result = buildRuleUpdates({
      trigger: baseTrigger, filters: [], action: baseAction,
      ruleName: '  ', sections, editingRule,
    });
    expect(result.name).toBeTruthy();
    expect(result.name!.length).toBeGreaterThan(0);
  });

  it('builds trigger and action objects', () => {
    const result = buildRuleUpdates({
      trigger: baseTrigger, filters: [], action: baseAction,
      ruleName: 'Test', sections, editingRule,
    });
    expect(result.trigger).toBeDefined();
    expect(result.trigger!.type).toBe('card_moved_into_section');
    expect(result.action).toBeDefined();
    expect(result.action!.type).toBe('move_card_to_top_of_section');
  });

  it('clears brokenReason when all section refs are valid', () => {
    const brokenRule = { ...editingRule, brokenReason: 'section_deleted', enabled: false };
    const result = buildRuleUpdates({
      trigger: baseTrigger, filters: [], action: baseAction,
      ruleName: 'Test', sections, editingRule: brokenRule,
    });
    expect(result.brokenReason).toBeNull();
    expect(result.enabled).toBe(true);
  });

  it('does not clear brokenReason when section refs are invalid', () => {
    const brokenRule = { ...editingRule, brokenReason: 'section_deleted', enabled: false };
    const badTrigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'nonexistent' };
    const result = buildRuleUpdates({
      trigger: badTrigger, filters: [], action: baseAction,
      ruleName: 'Test', sections, editingRule: brokenRule,
    });
    expect(result.brokenReason).toBeUndefined();
    expect(result.enabled).toBeUndefined();
  });

  it('preserves schedule and lastEvaluatedAt for scheduled triggers', () => {
    const scheduledRule: AutomationRule = {
      ...editingRule,
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 30 },
        lastEvaluatedAt: '2025-06-01T00:00:00.000Z',
        catchUpPolicy: 'catch_up_latest',
      } as any,
    };
    const scheduledTrigger: TriggerConfig = {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 60 },
      catchUpPolicy: 'skip_missed',
    };
    const result = buildRuleUpdates({
      trigger: scheduledTrigger, filters: [], action: baseAction,
      ruleName: 'Scheduled', sections, editingRule: scheduledRule,
    });
    const trigger = result.trigger as any;
    expect(trigger.schedule.intervalMinutes).toBe(60);
    expect(trigger.lastEvaluatedAt).toBe('2025-06-01T00:00:00.000Z');
    expect(trigger.catchUpPolicy).toBe('skip_missed');
  });
});

describe('buildNewRuleData', () => {
  it('returns data with projectId and enabled=true', () => {
    const result = buildNewRuleData({
      trigger: baseTrigger, filters: [], action: baseAction,
      ruleName: 'New Rule', sections, projectId: 'p1',
    });
    expect(result.projectId).toBe('p1');
    expect(result.enabled).toBe(true);
    expect(result.brokenReason).toBeNull();
    expect(result.bulkPausedAt).toBeNull();
  });

  it('builds trigger without lastEvaluatedAt for new rules', () => {
    const scheduledTrigger: TriggerConfig = {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 30 },
    };
    const result = buildNewRuleData({
      trigger: scheduledTrigger, filters: [], action: baseAction,
      ruleName: 'New Scheduled', sections, projectId: 'p1',
    });
    const trigger = result.trigger as any;
    expect(trigger.lastEvaluatedAt).toBeNull();
  });

  it('passes filters through', () => {
    const filters = [{ type: 'in_section' as const, sectionId: 's1' }];
    const result = buildNewRuleData({
      trigger: baseTrigger, filters, action: baseAction,
      ruleName: 'Filtered', sections, projectId: 'p1',
    });
    expect(result.filters).toEqual(filters);
  });
});
