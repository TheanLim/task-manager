'use client';

import { useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { RuleDialogStepFilters } from './RuleDialogStepFilters';
import { RuleDialogStepAction } from './RuleDialogStepAction';
import { RuleDialogStepReview } from './RuleDialogStepReview';
import { RulePreview } from '../RulePreview';
import { useAutomationRules } from '../../hooks/useAutomationRules';
import { useWizardState } from '../../hooks/useWizardState';
import type { PrefillTrigger } from '../../hooks/useWizardState';
import { buildRuleUpdates, buildNewRuleData } from '../../services/rules/ruleSaveService';
import type { AutomationRule } from '../../types';
import type { Section } from '@/lib/schemas';
import { useState } from 'react';

export type { PrefillTrigger };

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sections: Section[];
  editingRule?: AutomationRule | null;
  prefillTrigger?: PrefillTrigger | null;
}

export function RuleDialog({
  open,
  onOpenChange,
  projectId,
  sections,
  editingRule,
  prefillTrigger,
}: RuleDialogProps) {
  const { rules, createRule, updateRule } = useAutomationRules(projectId);

  const wizard = useWizardState(open, editingRule, prefillTrigger);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Refs for focus management
  const stepContentRef = useRef<HTMLDivElement>(null);

  // Focus management: focus first interactive element when step changes
  useEffect(() => {
    if (open && stepContentRef.current) {
      const timer = setTimeout(() => {
        const firstInput = stepContentRef.current?.querySelector<HTMLElement>(
          'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstInput?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [wizard.currentStep, open]);

  // Save handler
  const handleSave = useCallback(() => {
    if (wizard.isSaveDisabled) return;

    const commonParams = {
      trigger: wizard.trigger,
      filters: wizard.filters,
      action: wizard.action,
      ruleName: wizard.ruleName,
      sections,
    };

    if (editingRule) {
      updateRule(editingRule.id, buildRuleUpdates({ ...commonParams, editingRule }));
    } else {
      createRule(buildNewRuleData({ ...commonParams, projectId }));
    }

    wizard.resetDirty();
    onOpenChange(false);
  }, [
    wizard.isSaveDisabled,
    wizard.ruleName,
    wizard.trigger,
    wizard.filters,
    wizard.action,
    wizard.resetDirty,
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
      if (!newOpen && wizard.isDirty) {
        setShowDiscardDialog(true);
      } else {
        onOpenChange(newOpen);
      }
    },
    [wizard.isDirty, onOpenChange],
  );

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);
    wizard.resetDirty();
    onOpenChange(false);
  }, [onOpenChange, wizard.resetDirty]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  // Step indicator
  const steps = ['Trigger', 'Filters', 'Action', 'Review'];
  const visibleSteps = wizard.showFilters
    ? steps
    : steps.filter((_, idx) => idx !== 1);

  const getStepClickable = (stepIndex: number): boolean => {
    if (stepIndex === 0) return true;
    if (stepIndex === 1 && wizard.showFilters) return wizard.isStepValid(0);
    if (stepIndex === 2) return wizard.isStepValid(0);
    if (stepIndex === 3) return wizard.isStepValid(0) && wizard.isStepValid(2);
    return false;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl md:max-w-2xl sm:max-w-lg max-sm:h-full max-sm:max-w-full max-sm:rounded-none max-h-[90vh] max-sm:max-h-full overflow-hidden p-0 flex flex-col">
          <div className="p-6 sm:p-6 max-sm:p-4 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </DialogTitle>
              <DialogDescription>
                {editingRule
                  ? 'Modify the trigger, filters, and action for this automation rule.'
                  : 'Create a new automation rule to automatically perform actions when certain events occur.'}
              </DialogDescription>
            </DialogHeader>

            {/* Step Indicator */}
            <div className="flex items-center justify-between mt-6" role="navigation" aria-label="Wizard steps">
              {visibleSteps.map((stepName, displayIndex) => {
                const stepIndex = wizard.showFilters
                  ? displayIndex
                  : (displayIndex === 0 ? 0 : displayIndex === 1 ? 2 : 3);

                const isActive = wizard.currentStep === stepIndex;
                const isComplete = wizard.currentStep > stepIndex;
                const isClickable = getStepClickable(stepIndex);

                return (
                  <div key={stepName} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => isClickable && wizard.handleNavigateToStep(stepIndex as 0 | 1 | 2 | 3)}
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
                        {displayIndex + 1}
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
                    {displayIndex < visibleSteps.length - 1 && (
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
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {wizard.stepAnnouncement}
            </div>

            <div className="space-y-6 pb-6">
              {wizard.currentStep === 0 && (
                <RuleDialogStepTrigger
                  trigger={wizard.trigger}
                  onTriggerChange={wizard.handleTriggerChange}
                  sections={sections}
                />
              )}

              {wizard.currentStep === 1 && (
                <RuleDialogStepFilters
                  filters={wizard.filters}
                  onFiltersChange={wizard.handleFiltersChange}
                  onSkip={wizard.handleSkipFilters}
                  sections={sections}
                />
              )}

              {wizard.currentStep === 2 && (
                <RuleDialogStepAction
                  action={wizard.action}
                  onActionChange={wizard.handleActionChange}
                  sections={sections}
                  triggerType={wizard.trigger.type}
                />
              )}

              {wizard.currentStep === 3 && (
                <RuleDialogStepReview
                  trigger={wizard.trigger}
                  action={wizard.action}
                  filters={wizard.filters}
                  ruleName={wizard.ruleName}
                  onRuleNameChange={wizard.handleRuleNameChange}
                  onFiltersChange={wizard.handleFiltersChange}
                  sections={sections}
                  onNavigateToStep={wizard.handleNavigateToStep}
                  onSave={handleSave}
                  isSaveDisabled={wizard.isSaveDisabled}
                  existingRules={rules}
                  editingRuleId={editingRule?.id}
                />
              )}

              {wizard.hasSameSectionWarning && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Moving a card to the same section has no effect.
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  PREVIEW
                </p>
                <RulePreview trigger={wizard.trigger} action={wizard.action} sections={sections} filters={wizard.filters} />
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex-shrink-0 border-t bg-background max-sm:sticky max-sm:bottom-0">
            <div className="flex justify-between gap-2 p-6 sm:p-6 max-sm:p-4">
              <Button
                type="button"
                variant="outline"
                onClick={wizard.handleBack}
                disabled={wizard.currentStep === 0}
              >
                Back
              </Button>
              {wizard.currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={wizard.handleNext}
                  disabled={!wizard.isStepValid(wizard.currentStep)}
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
