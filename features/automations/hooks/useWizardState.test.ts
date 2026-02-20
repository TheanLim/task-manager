import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardState } from './useWizardState';
import type { AutomationRule } from '../types';

const makeRule = (overrides: Partial<AutomationRule> = {}): AutomationRule => ({
  id: 'rule-1',
  projectId: 'proj-1',
  name: 'Test Rule',
  trigger: { type: 'card_marked_complete', sectionId: null },
  filters: [],
  action: { type: 'mark_card_incomplete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
  enabled: true,
  brokenReason: null,
  bulkPausedAt: null,
  executionCount: 0,
  lastExecutedAt: null,
  recentExecutions: [],
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useWizardState', () => {
  it('starts at step 0 with empty state when no editing rule', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    expect(result.current.currentStep).toBe(0);
    expect(result.current.trigger.type).toBeNull();
    expect(result.current.action.type).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });

  it('pre-populates from editing rule', () => {
    const rule = makeRule();
    const { result } = renderHook(() => useWizardState(true, rule, null));
    expect(result.current.trigger.type).toBe('card_marked_complete');
    expect(result.current.action.type).toBe('mark_card_incomplete');
    expect(result.current.ruleName).toBe('Test Rule');
  });

  it('marks dirty on trigger change', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    expect(result.current.isDirty).toBe(false);
    act(() => {
      result.current.handleTriggerChange({ type: 'card_marked_complete', sectionId: null });
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('navigates forward when step is valid', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    // Set a valid trigger
    act(() => {
      result.current.handleTriggerChange({ type: 'card_marked_complete', sectionId: null });
    });
    expect(result.current.isStepValid(0)).toBe(true);
    act(() => {
      result.current.handleNext();
    });
    // card_marked_complete shows filters step
    expect(result.current.currentStep).toBe(1);
  });

  it('skips filters step for section-level triggers', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    act(() => {
      result.current.handleTriggerChange({ type: 'section_created', sectionId: null });
    });
    expect(result.current.showFilters).toBe(false);
    act(() => {
      result.current.handleNext();
    });
    // Should skip to step 2 (Action)
    expect(result.current.currentStep).toBe(2);
  });

  it('navigates back correctly', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    act(() => {
      result.current.handleTriggerChange({ type: 'card_marked_complete', sectionId: null });
    });
    act(() => { result.current.handleNext(); }); // step 1
    act(() => { result.current.handleNext(); }); // step 2
    expect(result.current.currentStep).toBe(2);
    act(() => { result.current.handleBack(); });
    expect(result.current.currentStep).toBe(1);
  });

  it('detects same-section warning', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    act(() => {
      result.current.handleTriggerChange({ type: 'card_moved_into_section', sectionId: 'sec-1' });
      result.current.handleActionChange({
        type: 'move_card_to_top_of_section', sectionId: 'sec-1',
        dateOption: null, position: 'top', cardTitle: null, cardDateOption: null,
        specificMonth: null, specificDay: null, monthTarget: null,
      });
    });
    expect(result.current.hasSameSectionWarning).toBe(true);
  });

  it('resetDirty clears dirty flag', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    act(() => {
      result.current.handleRuleNameChange('test');
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.resetDirty();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('applies prefill trigger on open', () => {
    const prefill = { triggerType: 'card_moved_into_section' as const, sectionId: 'sec-1' };
    const { result } = renderHook(() => useWizardState(true, null, prefill));
    expect(result.current.trigger.type).toBe('card_moved_into_section');
    expect(result.current.trigger.sectionId).toBe('sec-1');
  });

  it('isSaveDisabled when trigger or action invalid', () => {
    const { result } = renderHook(() => useWizardState(true, null, null));
    expect(result.current.isSaveDisabled).toBe(true);
    act(() => {
      result.current.handleTriggerChange({ type: 'card_marked_complete', sectionId: null });
    });
    // Still disabled — no action
    expect(result.current.isSaveDisabled).toBe(true);
    act(() => {
      result.current.handleActionChange({
        type: 'mark_card_complete', sectionId: null,
        dateOption: null, position: null, cardTitle: null, cardDateOption: null,
        specificMonth: null, specificDay: null, monthTarget: null,
      });
    });
    expect(result.current.isSaveDisabled).toBe(false);
  });
});
