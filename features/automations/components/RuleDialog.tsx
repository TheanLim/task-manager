'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RuleDialogStepTrigger } from './RuleDialogStepTrigger';
import { RuleDialogStepAction } from './RuleDialogStepAction';
import { RuleDialogStepReview } from './RuleDialogStepReview';
import { RulePreview } from './RulePreview';
import { useAutomationRules } from '../hooks/useAutomationRules';
import {
  TRIGGER_META,
  ACTION_META,
  buildPreviewParts,
  buildPreviewString,
  type TriggerConfig,
  type ActionConfig,
} from '../services/rulePreviewService';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sections: Section[];
  editingRule?: AutomationRule | null;
}

type WizardStep = 0 | 1 | 2; // 0 = Trigger, 1 = Action, 2 = Review

export function RuleDialog({
  open,
  onOpenChange,
  projectId,
  sections,
  editingRule,
}: RuleDialogProps) {
  const { createRule, updateRule } = useAutomationRules(projectId);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [trigger, setTrigger] = useState<TriggerConfig>({
    type: null,
    sectionId: null,
  });
  const [action, setAction] = useState<ActionConfig>({
    type: null,
    sectionId: null,
    dateOption: null,
    position: null,
  });
  const [ruleName, setRuleName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [stepAnnouncement, setStepAnnouncement] = useState('');

  // Refs for focus management
  const stepContentRef = useRef<HTMLDivElement>(null);

  // Pre-populate form when editing
  useEffect(() => {
    if (open && editingRule) {
      setTrigger({
        type: editingRule.trigger.type,
        sectionId: editingRule.trigger.sectionId,
      });
      setAction({
        type: editingRule.action.type,
        sectionId: editingRule.action.sectionId,
        dateOption: editingRule.action.dateOption,
        position: editingRule.action.position,
      });
      setRuleName(editingRule.name);
      setIsDirty(false);
    } else if (open && !editingRule) {
      // Reset form for new rule
      setTrigger({ type: null, sectionId: null });
      setAction({ type: null, sectionId: null, dateOption: null, position: null });
      setRuleName('');
      setIsDirty(false);
      setCurrentStep(0);
    }
  }, [open, editingRule]);

  // Mark form as dirty when user makes changes
  const handleTriggerChange = useCallback((newTrigger: TriggerConfig) => {
    setTrigger(newTrigger);
    setIsDirty(true);
  }, []);

  const handleActionChange = useCallback((newAction: ActionConfig) => {
    setAction(newAction);
    setIsDirty(true);
  }, []);

  const handleRuleNameChange = useCallback((name: string) => {
    setRuleName(name);
    setIsDirty(true);
  }, []);

  // Validation helpers
  const isTriggerValid = useCallback(() => {
    if (!trigger.type) return false;
    const triggerMeta = TRIGGER_META.find((t) => t.type === trigger.type);
    if (!triggerMeta) return false;
    if (triggerMeta.needsSection && !trigger.sectionId) return false;
    return true;
  }, [trigger]);

  const isActionValid = useCallback(() => {
    if (!action.type) return false;
    const actionMeta = ACTION_META.find((a) => a.type === action.type);
    if (!actionMeta) return false;
    if (actionMeta.needsSection && !action.sectionId) return false;
    if (actionMeta.needsDateOption && !action.dateOption) return false;
    return true;
  }, [action]);

  const isStepValid = useCallback(
    (step: WizardStep) => {
      if (step === 0) return isTriggerValid();
      if (step === 1) return isActionValid();
      if (step === 2) return isTriggerValid() && isActionValid();
      return false;
    },
    [isTriggerValid, isActionValid]
  );

  const isSaveDisabled = !isTriggerValid() || !isActionValid();

  // Check for same-section warning
  const hasSameSectionWarning =
    trigger.type &&
    (trigger.type === 'card_moved_into_section' ||
      trigger.type === 'card_moved_out_of_section') &&
    action.type &&
    (action.type === 'move_card_to_top_of_section' ||
      action.type === 'move_card_to_bottom_of_section') &&
    trigger.sectionId &&
    action.sectionId &&
    trigger.sectionId === action.sectionId;

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentStep === 0 && isStepValid(0)) {
      setCurrentStep(1);
    } else if (currentStep === 1 && isStepValid(1)) {
      setCurrentStep(2);
    }
  }, [currentStep, isStepValid]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  }, [currentStep]);

  const handleNavigateToStep = useCallback(
    (step: WizardStep) => {
      // Can only navigate to a step if all preceding steps are valid
      if (step === 0) {
        setCurrentStep(0);
      } else if (step === 1 && isStepValid(0)) {
        setCurrentStep(1);
      } else if (step === 2 && isStepValid(0) && isStepValid(1)) {
        setCurrentStep(2);
      }
      
      // Announce step change for screen readers
      const stepNames = ['Trigger', 'Action', 'Review'];
      setStepAnnouncement(`Step ${step + 1} of 3: ${stepNames[step]}`);
    },
    [isStepValid]
  );

  // Focus management: focus first interactive element when step changes
  useEffect(() => {
    if (open && stepContentRef.current) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        const firstInput = stepContentRef.current?.querySelector<HTMLElement>(
          'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstInput?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, open]);

  // Save handler
  const handleSave = useCallback(() => {
    if (isSaveDisabled) return;

    // Build section lookup
    const sectionLookup = (id: string) => sections.find((s) => s.id === id)?.name;

    // Auto-generate name if blank
    const finalName =
      ruleName.trim() ||
      buildPreviewString(buildPreviewParts(trigger, action, sectionLookup));

    if (editingRule) {
      // Update existing rule
      updateRule(editingRule.id, {
        name: finalName,
        trigger: {
          type: trigger.type!,
          sectionId: trigger.sectionId,
        },
        action: {
          type: action.type!,
          sectionId: action.sectionId,
          dateOption: action.dateOption,
          position: action.position,
        },
      });
    } else {
      // Create new rule
      createRule({
        projectId,
        name: finalName,
        trigger: {
          type: trigger.type!,
          sectionId: trigger.sectionId,
        },
        action: {
          type: action.type!,
          sectionId: action.sectionId,
          dateOption: action.dateOption,
          position: action.position,
        },
        enabled: true,
        brokenReason: null,
      });
    }

    // Close dialog
    setIsDirty(false);
    onOpenChange(false);
  }, [
    isSaveDisabled,
    ruleName,
    trigger,
    action,
    sections,
    editingRule,
    updateRule,
    createRule,
    projectId,
    onOpenChange,
  ]);

  // Handle dialog close with dirty check
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isDirty) {
        // Show confirmation dialog
        setShowDiscardDialog(true);
      } else {
        onOpenChange(newOpen);
      }
    },
    [isDirty, onOpenChange]
  );

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);
    setIsDirty(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  // Step indicator
  const steps = ['Trigger', 'Action', 'Review'];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl md:max-w-2xl sm:max-w-lg max-sm:h-full max-sm:max-w-full max-sm:rounded-none max-h-[90vh] max-sm:max-h-full overflow-hidden p-0 flex flex-col">
          <div className="p-6 sm:p-6 max-sm:p-4 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </DialogTitle>
            </DialogHeader>

            {/* Step Indicator - Full labels on larger screens, dots on mobile */}
            <div className="flex items-center justify-between mt-6" role="navigation" aria-label="Wizard steps">
              {steps.map((stepName, index) => {
                const stepIndex = index as WizardStep;
                const isActive = currentStep === stepIndex;
                const isComplete = currentStep > stepIndex;
                const isClickable =
                  stepIndex === 0 ||
                  (stepIndex === 1 && isStepValid(0)) ||
                  (stepIndex === 2 && isStepValid(0) && isStepValid(1));

                return (
                  <div key={stepName} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => isClickable && handleNavigateToStep(stepIndex)}
                      disabled={!isClickable}
                      className={`flex items-center gap-2 ${
                        isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 max-sm:h-3 max-sm:w-3 items-center justify-center rounded-full border-2 max-sm:border text-sm max-sm:text-[0px] font-medium transition-colors ${
                          isActive
                            ? 'border-accent-brand bg-accent-brand text-white'
                            : isComplete
                              ? 'border-accent-brand bg-accent-brand/10 text-accent-brand max-sm:bg-accent-brand'
                              : 'border-muted-foreground/30 bg-background text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={`text-sm font-medium max-sm:hidden ${
                          isActive || isComplete
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {stepName}
                      </span>
                    </button>
                    {index < steps.length - 1 && (
                      <div
                        className={`mx-2 max-sm:mx-1 h-0.5 flex-1 ${
                          isComplete ? 'bg-accent-brand' : 'bg-muted-foreground/30'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Content */}
          <div ref={stepContentRef} className="flex-1 overflow-y-auto px-6 sm:px-6 max-sm:px-4">
            {/* Aria-live region for step announcements */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {stepAnnouncement}
            </div>
            
            <div className="space-y-6 pb-6">
              {currentStep === 0 && (
                <RuleDialogStepTrigger
                  trigger={trigger}
                  onTriggerChange={handleTriggerChange}
                  sections={sections}
                />
              )}

              {currentStep === 1 && (
                <RuleDialogStepAction
                  action={action}
                  onActionChange={handleActionChange}
                  sections={sections}
                />
              )}

              {currentStep === 2 && (
                <RuleDialogStepReview
                  trigger={trigger}
                  action={action}
                  ruleName={ruleName}
                  onRuleNameChange={handleRuleNameChange}
                  sections={sections}
                  onNavigateToStep={handleNavigateToStep}
                  onSave={handleSave}
                  isSaveDisabled={isSaveDisabled}
                />
              )}

              {/* Same-section warning */}
              {hasSameSectionWarning && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Moving a card to the same section has no effect.
                </div>
              )}

              {/* Rule Preview (always visible) */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  PREVIEW
                </p>
                <RulePreview trigger={trigger} action={action} sections={sections} />
              </div>
            </div>
          </div>

          {/* Navigation Buttons - Sticky on mobile */}
          <div className="flex-shrink-0 border-t bg-background max-sm:sticky max-sm:bottom-0">
            <div className="flex justify-between gap-2 p-6 sm:p-6 max-sm:p-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </Button>
              {currentStep < 2 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid(currentStep)}
                  className="bg-accent-brand hover:bg-accent-brand/90 text-white"
                >
                  Next
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close this dialog?
              Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
