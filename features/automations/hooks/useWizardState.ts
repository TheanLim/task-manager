/**
 * Wizard state machine for the rule creation/edit dialog.
 * Manages step navigation, validation, dirty tracking, and form state.
 * Extracted from RuleDialog.tsx to separate state logic from UI chrome.
 */

import { useState, useEffect, useCallback } from 'react';
import { TRIGGER_META, ACTION_META } from '../services/preview/ruleMetadata';
import type { TriggerConfig, ActionConfig } from '../services/configTypes';
import type { AutomationRule, CardFilter, TriggerType } from '../types';

export type WizardStep = 0 | 1 | 2 | 3 | 4; // 0=Scope (global only), 1=Trigger, 2=Filters, 3=Action, 4=Review

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
  scope: 'all' | 'selected' | 'all_except';
  selectedProjectIds: string[];
  isDirty: boolean;
  stepAnnouncement: string;
  showFilters: boolean;
  isSaveDisabled: boolean;
  hasSameSectionWarning: boolean;

  handleTriggerChange: (t: TriggerConfig) => void;
  handleFiltersChange: (f: CardFilter[]) => void;
  handleActionChange: (a: ActionConfig) => void;
  handleRuleNameChange: (name: string) => void;
  handleScopeChange: (updates: { scope: 'all' | 'selected'; selectedProjectIds: string[] }) => void;
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
  isGlobal = false,
  promoteFromRule?: AutomationRule | null,
): UseWizardStateReturn {
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [trigger, setTrigger] = useState<TriggerConfig>({ type: null, sectionId: null });
  const [filters, setFilters] = useState<CardFilter[]>([]);
  const [action, setAction] = useState<ActionConfig>(EMPTY_ACTION);
  const [ruleName, setRuleName] = useState('');
  const [scope, setScope] = useState<'all' | 'selected' | 'all_except'>('all');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
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
      setScope(editingRule.scope || 'all');
      setSelectedProjectIds(editingRule.selectedProjectIds || []);
      setIsDirty(false);
    } else if (open && promoteFromRule) {
      // Promotion flow: pre-fill from source rule
      setTrigger({
        type: promoteFromRule.trigger.type,
        sectionId: promoteFromRule.trigger.sectionId,
        sectionName: (promoteFromRule.trigger as any).sectionName,
        schedule: (promoteFromRule.trigger as any).schedule,
        lastEvaluatedAt: (promoteFromRule.trigger as any).lastEvaluatedAt,
        catchUpPolicy: (promoteFromRule.trigger as any).catchUpPolicy,
      });
      setFilters(promoteFromRule.filters || []);
      setAction({
        type: promoteFromRule.action.type,
        sectionId: promoteFromRule.action.sectionId,
        sectionName: (promoteFromRule.action as any).sectionName,
        dateOption: promoteFromRule.action.dateOption,
        position: promoteFromRule.action.position,
        cardTitle: promoteFromRule.action.cardTitle,
        cardDateOption: promoteFromRule.action.cardDateOption,
        specificMonth: promoteFromRule.action.specificMonth,
        specificDay: promoteFromRule.action.specificDay,
        monthTarget: promoteFromRule.action.monthTarget,
      });
      setRuleName(`${promoteFromRule.name} (Global)`);
      setScope('selected');
      setSelectedProjectIds(promoteFromRule.projectId ? [promoteFromRule.projectId] : []);
      setIsDirty(false);
      setCurrentStep(0);
    } else if (open && !editingRule) {
      setTrigger({
        type: prefillTrigger?.triggerType ?? null,
        sectionId: prefillTrigger?.sectionId ?? null,
      });
      setFilters([]);
      setAction(EMPTY_ACTION);
      setRuleName('');
      setScope('all');
      setSelectedProjectIds([]);
      setIsDirty(false);
      setCurrentStep(0);
    }
  }, [open, editingRule, prefillTrigger, promoteFromRule]);

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

  const handleScopeChange = useCallback((updates: { scope: 'all' | 'selected'; selectedProjectIds: string[] }) => {
    setScope(updates.scope);
    setSelectedProjectIds(updates.selectedProjectIds);
    setIsDirty(true);
  }, []);

  // Validation
  const isScopeValid = useCallback(() => {
    if (!isGlobal) return true; // Project rules don't have scope step
    if (scope === 'all') return true;
    if (scope === 'selected') return selectedProjectIds.length > 0;
    return false;
  }, [isGlobal, scope, selectedProjectIds]);

  const isTriggerValid = useCallback(() => {
    if (!trigger.type) return false;
    const meta = TRIGGER_META.find((t) => t.type === trigger.type);
    if (!meta) return false;
    if (meta.needsSection) {
      // Global rules satisfy section requirement with a name; project rules need an ID
      const hasSection = isGlobal ? !!trigger.sectionName : !!trigger.sectionId;
      if (!hasSection) return false;
    }
    if (meta.needsSchedule && !trigger.schedule) return false;
    return true;
  }, [trigger, isGlobal]);

  const isActionValid = useCallback(() => {
    if (!action.type) return false;
    const meta = ACTION_META.find((a) => a.type === action.type);
    if (!meta) return false;
    if (meta.needsSection) {
      const hasSection = isGlobal ? !!action.sectionName : !!action.sectionId;
      if (!hasSection) return false;
    }
    if (meta.needsDateOption && !action.dateOption) return false;
    return true;
  }, [action, isGlobal]);

  const isStepValid = useCallback(
    (step: WizardStep) => {
      if (isGlobal) {
        // Global rules: 0=Scope, 1=Trigger, 2=Filters, 3=Action, 4=Review
        if (step === 0) return isScopeValid();
        if (step === 1) return isTriggerValid();
        if (step === 2) return true; // Filters always valid (optional)
        if (step === 3) return isActionValid();
        if (step === 4) return isScopeValid() && isTriggerValid() && isActionValid();
      } else {
        // Project rules: 0=Trigger, 1=Filters, 2=Action, 3=Review
        if (step === 0) return isTriggerValid();
        if (step === 1) return true; // Filters always valid (optional)
        if (step === 2) return isActionValid();
        if (step === 3) return isTriggerValid() && isActionValid();
      }
      return false;
    },
    [isGlobal, isScopeValid, isTriggerValid, isActionValid],
  );

  const isSaveDisabled = isGlobal
    ? !isScopeValid() || !isTriggerValid() || !isActionValid()
    : !isTriggerValid() || !isActionValid();

  // Same-section warning
  const hasSameSectionWarning =
    !!trigger.type &&
    (trigger.type === 'card_moved_into_section' || trigger.type === 'card_moved_out_of_section') &&
    !!action.type &&
    (action.type === 'move_card_to_top_of_section' || action.type === 'move_card_to_bottom_of_section') &&
    (isGlobal
      ? !!trigger.sectionName && !!action.sectionName && trigger.sectionName === action.sectionName
      : !!trigger.sectionId && !!action.sectionId && trigger.sectionId === action.sectionId);

  // Navigation
  const handleNext = useCallback(() => {
    if (isGlobal) {
      // Global rules: 0=Scope, 1=Trigger, 2=Filters, 3=Action, 4=Review
      if (currentStep === 0 && isStepValid(0)) {
        setCurrentStep(1);
      } else if (currentStep === 1 && isStepValid(1)) {
        setCurrentStep(shouldShowFiltersStep() ? 2 : 3);
      } else if (currentStep === 2 && isStepValid(2)) {
        setCurrentStep(3);
      } else if (currentStep === 3 && isStepValid(3)) {
        setCurrentStep(4);
      }
    } else {
      // Project rules: 0=Trigger, 1=Filters, 2=Action, 3=Review
      if (currentStep === 0 && isStepValid(0)) {
        setCurrentStep(shouldShowFiltersStep() ? 1 : 2);
      } else if (currentStep === 1 && isStepValid(1)) {
        setCurrentStep(2);
      } else if (currentStep === 2 && isStepValid(2)) {
        setCurrentStep(3);
      }
    }
  }, [currentStep, isGlobal, isStepValid, shouldShowFiltersStep]);

  const handleBack = useCallback(() => {
    if (isGlobal) {
      // Global rules: 0=Scope, 1=Trigger, 2=Filters, 3=Action, 4=Review
      if (currentStep === 1) {
        setCurrentStep(0);
      } else if (currentStep === 2) {
        setCurrentStep(1);
      } else if (currentStep === 3) {
        setCurrentStep(shouldShowFiltersStep() ? 2 : 1);
      } else if (currentStep === 4) {
        setCurrentStep(3);
      }
    } else {
      // Project rules: 0=Trigger, 1=Filters, 2=Action, 3=Review
      if (currentStep === 1) {
        setCurrentStep(0);
      } else if (currentStep === 2) {
        setCurrentStep(shouldShowFiltersStep() ? 1 : 0);
      } else if (currentStep === 3) {
        setCurrentStep(2);
      }
    }
  }, [currentStep, isGlobal, shouldShowFiltersStep]);

  const handleSkipFilters = useCallback(() => {
    setFilters([]);
    setCurrentStep(isGlobal ? 3 : 2);
  }, [isGlobal]);

  const handleNavigateToStep = useCallback(
    (step: WizardStep) => {
      const sf = shouldShowFiltersStep();
      
      if (isGlobal) {
        // Global rules: 0=Scope, 1=Trigger, 2=Filters, 3=Action, 4=Review
        if (step === 0) {
          setCurrentStep(0);
        } else if (step === 1 && isStepValid(0)) {
          setCurrentStep(1);
        } else if (step === 2 && sf && isStepValid(0) && isStepValid(1)) {
          setCurrentStep(2);
        } else if (step === 3 && isStepValid(0) && isStepValid(1)) {
          setCurrentStep(3);
        } else if (step === 4 && isStepValid(0) && isStepValid(1) && isStepValid(3)) {
          setCurrentStep(4);
        }
        const stepNames = ['Scope', 'Trigger', 'Filters', 'Action', 'Review'];
        setStepAnnouncement(`Step ${step + 1} of 5: ${stepNames[step]}`);
      } else {
        // Project rules: 0=Trigger, 1=Filters, 2=Action, 3=Review
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
      }
    },
    [isGlobal, isStepValid, shouldShowFiltersStep],
  );

  const resetDirty = useCallback(() => setIsDirty(false), []);

  return {
    currentStep,
    trigger,
    filters,
    action,
    ruleName,
    scope,
    selectedProjectIds,
    isDirty,
    stepAnnouncement,
    showFilters,
    isSaveDisabled,
    hasSameSectionWarning,
    handleTriggerChange,
    handleFiltersChange,
    handleActionChange,
    handleRuleNameChange,
    handleScopeChange,
    handleNext,
    handleBack,
    handleSkipFilters,
    handleNavigateToStep,
    isStepValid,
    resetDirty,
  };
}
