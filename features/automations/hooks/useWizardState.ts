/**
 * Wizard state machine for the rule creation/edit dialog.
 * Manages step navigation, validation, dirty tracking, and form state.
 * Extracted from RuleDialog.tsx to separate state logic from UI chrome.
 */

import { useState, useEffect, useCallback } from 'react';
import { TRIGGER_META, ACTION_META } from '../services/preview/ruleMetadata';
import type { TriggerConfig, ActionConfig } from '../services/configTypes';
import type { AutomationRule, CardFilter, TriggerType } from '../types';

export type WizardStep = 0 | 1 | 2 | 3; // 0=Trigger, 1=Filters, 2=Action, 3=Review

export interface PrefillTrigger {
  triggerType: TriggerType;
  sectionId: string;
}

const EMPTY_ACTION: ActionConfig = {
  type: null,
  sectionId: null,
  dateOption: null,
  position: null,
  cardTitle: null,
  cardDateOption: null,
  specificMonth: null,
  specificDay: null,
  monthTarget: null,
};

export interface UseWizardStateReturn {
  currentStep: WizardStep;
  trigger: TriggerConfig;
  filters: CardFilter[];
  action: ActionConfig;
  ruleName: string;
  isDirty: boolean;
  stepAnnouncement: string;
  showFilters: boolean;
  isSaveDisabled: boolean;
  hasSameSectionWarning: boolean;

  handleTriggerChange: (t: TriggerConfig) => void;
  handleFiltersChange: (f: CardFilter[]) => void;
  handleActionChange: (a: ActionConfig) => void;
  handleRuleNameChange: (name: string) => void;
  handleNext: () => void;
  handleBack: () => void;
  handleSkipFilters: () => void;
  handleNavigateToStep: (step: WizardStep) => void;
  isStepValid: (step: WizardStep) => boolean;
  resetDirty: () => void;
}

export function useWizardState(
  open: boolean,
  editingRule: AutomationRule | null | undefined,
  prefillTrigger: PrefillTrigger | null | undefined,
): UseWizardStateReturn {
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [trigger, setTrigger] = useState<TriggerConfig>({ type: null, sectionId: null });
  const [filters, setFilters] = useState<CardFilter[]>([]);
  const [action, setAction] = useState<ActionConfig>(EMPTY_ACTION);
  const [ruleName, setRuleName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [stepAnnouncement, setStepAnnouncement] = useState('');

  // Determine if filters step should be shown for the current trigger
  const shouldShowFiltersStep = useCallback(() => {
    if (!trigger.type) return true;
    const sectionLevelTriggers = ['section_created', 'section_renamed'];
    return !sectionLevelTriggers.includes(trigger.type);
  }, [trigger.type]);

  const showFilters = shouldShowFiltersStep();

  // Pre-populate form when editing or reset for new
  useEffect(() => {
    if (open && editingRule) {
      setTrigger({
        type: editingRule.trigger.type,
        sectionId: editingRule.trigger.sectionId,
        schedule: (editingRule.trigger as any).schedule,
        lastEvaluatedAt: (editingRule.trigger as any).lastEvaluatedAt,
        catchUpPolicy: (editingRule.trigger as any).catchUpPolicy,
      });
      setFilters(editingRule.filters || []);
      setAction({
        type: editingRule.action.type,
        sectionId: editingRule.action.sectionId,
        dateOption: editingRule.action.dateOption,
        position: editingRule.action.position,
        cardTitle: editingRule.action.cardTitle,
        cardDateOption: editingRule.action.cardDateOption,
        specificMonth: editingRule.action.specificMonth,
        specificDay: editingRule.action.specificDay,
        monthTarget: editingRule.action.monthTarget,
      });
      setRuleName(editingRule.name);
      setIsDirty(false);
    } else if (open && !editingRule) {
      setTrigger({
        type: prefillTrigger?.triggerType ?? null,
        sectionId: prefillTrigger?.sectionId ?? null,
      });
      setFilters([]);
      setAction(EMPTY_ACTION);
      setRuleName('');
      setIsDirty(false);
      setCurrentStep(0);
    }
  }, [open, editingRule, prefillTrigger]);

  // Change handlers that mark dirty
  const handleTriggerChange = useCallback((t: TriggerConfig) => {
    setTrigger(t);
    setIsDirty(true);
  }, []);

  const handleFiltersChange = useCallback((f: CardFilter[]) => {
    setFilters(f);
    setIsDirty(true);
  }, []);

  const handleActionChange = useCallback((a: ActionConfig) => {
    setAction(a);
    setIsDirty(true);
  }, []);

  const handleRuleNameChange = useCallback((name: string) => {
    setRuleName(name);
    setIsDirty(true);
  }, []);

  // Validation
  const isTriggerValid = useCallback(() => {
    if (!trigger.type) return false;
    const meta = TRIGGER_META.find((t) => t.type === trigger.type);
    if (!meta) return false;
    if (meta.needsSection && !trigger.sectionId) return false;
    if (meta.needsSchedule && !trigger.schedule) return false;
    return true;
  }, [trigger]);

  const isActionValid = useCallback(() => {
    if (!action.type) return false;
    const meta = ACTION_META.find((a) => a.type === action.type);
    if (!meta) return false;
    if (meta.needsSection && !action.sectionId) return false;
    if (meta.needsDateOption && !action.dateOption) return false;
    return true;
  }, [action]);

  const isStepValid = useCallback(
    (step: WizardStep) => {
      if (step === 0) return isTriggerValid();
      if (step === 1) return true; // Filters always valid (optional)
      if (step === 2) return isActionValid();
      if (step === 3) return isTriggerValid() && isActionValid();
      return false;
    },
    [isTriggerValid, isActionValid],
  );

  const isSaveDisabled = !isTriggerValid() || !isActionValid();

  // Same-section warning
  const hasSameSectionWarning =
    !!trigger.type &&
    (trigger.type === 'card_moved_into_section' || trigger.type === 'card_moved_out_of_section') &&
    !!action.type &&
    (action.type === 'move_card_to_top_of_section' || action.type === 'move_card_to_bottom_of_section') &&
    !!trigger.sectionId &&
    !!action.sectionId &&
    trigger.sectionId === action.sectionId;

  // Navigation
  const handleNext = useCallback(() => {
    if (currentStep === 0 && isStepValid(0)) {
      setCurrentStep(shouldShowFiltersStep() ? 1 : 2);
    } else if (currentStep === 1 && isStepValid(1)) {
      setCurrentStep(2);
    } else if (currentStep === 2 && isStepValid(2)) {
      setCurrentStep(3);
    }
  }, [currentStep, isStepValid, shouldShowFiltersStep]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      setCurrentStep(0);
    } else if (currentStep === 2) {
      setCurrentStep(shouldShowFiltersStep() ? 1 : 0);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
  }, [currentStep, shouldShowFiltersStep]);

  const handleSkipFilters = useCallback(() => {
    setFilters([]);
    setCurrentStep(2);
  }, []);

  const handleNavigateToStep = useCallback(
    (step: WizardStep) => {
      const sf = shouldShowFiltersStep();
      if (step === 0) {
        setCurrentStep(0);
      } else if (step === 1 && sf && isStepValid(0)) {
        setCurrentStep(1);
      } else if (step === 2 && isStepValid(0)) {
        setCurrentStep(2);
      } else if (step === 3 && isStepValid(0) && isStepValid(2)) {
        setCurrentStep(3);
      }
      const stepNames = ['Trigger', 'Filters', 'Action', 'Review'];
      setStepAnnouncement(`Step ${step + 1} of 4: ${stepNames[step]}`);
    },
    [isStepValid, shouldShowFiltersStep],
  );

  const resetDirty = useCallback(() => setIsDirty(false), []);

  return {
    currentStep,
    trigger,
    filters,
    action,
    ruleName,
    isDirty,
    stepAnnouncement,
    showFilters,
    isSaveDisabled,
    hasSameSectionWarning,
    handleTriggerChange,
    handleFiltersChange,
    handleActionChange,
    handleRuleNameChange,
    handleNext,
    handleBack,
    handleSkipFilters,
    handleNavigateToStep,
    isStepValid,
    resetDirty,
  };
}
