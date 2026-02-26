'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AppState } from '@/types';

export interface SharedStateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedState: AppState;
  currentState: {
    projects: number;
    tasks: number;
    sections: number;
    dependencies: number;
  };
  onConfirm: (mode: 'replace' | 'merge' | 'cancel', options?: { includeAutomations: boolean }) => void;
}

export function SharedStateDialog({
  open,
  onOpenChange,
  sharedState,
  currentState,
  onConfirm,
}: SharedStateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [includeAutomations, setIncludeAutomations] = useState(true);

  const handleConfirm = (mode: 'replace' | 'merge' | 'cancel') => {
    if (mode === 'cancel') {
      onOpenChange(false);
      onConfirm('cancel');
      return;
    }

    setIsLoading(true);
    onConfirm(mode, { includeAutomations });
    // Loading state will be cleared by parent
  };

  const sharedDataCount = {
    projects: sharedState.projects.length,
    tasks: sharedState.tasks.length,
    sections: sharedState.sections.length,
    dependencies: sharedState.dependencies.length,
  };

  const automationRuleCount = Array.isArray((sharedState as Record<string, unknown>).automationRules)
    ? ((sharedState as Record<string, unknown>).automationRules as unknown[]).length
    : 0;

  const hasCurrentData = 
    currentState.projects > 0 || 
    currentState.tasks > 0 || 
    currentState.sections > 0 || 
    currentState.dependencies > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load shared data</DialogTitle>
          <DialogDescription>
            {hasCurrentData
              ? 'You already have data. How should the shared data be loaded?'
              : 'Load this shared data into your workspace?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Data */}
          {hasCurrentData && (
            <div className="rounded-md bg-muted p-4">
              <h4 className="mb-2 font-semibold text-sm">Your current data</h4>
              <ul className="space-y-1 text-sm">
                <li>{currentState.projects} project{currentState.projects !== 1 ? 's' : ''}</li>
                <li>{currentState.tasks} task{currentState.tasks !== 1 ? 's' : ''}</li>
                <li>{currentState.sections} section{currentState.sections !== 1 ? 's' : ''}</li>
                <li>{currentState.dependencies} dependenc{currentState.dependencies !== 1 ? 'ies' : 'y'}</li>
              </ul>
            </div>
          )}

          {/* Shared Data */}
          <div className="rounded-md bg-primary/10 p-4">
            <h4 className="mb-2 font-semibold text-sm">Shared data</h4>
            <ul className="space-y-1 text-sm">
              <li>{sharedDataCount.projects} project{sharedDataCount.projects !== 1 ? 's' : ''}</li>
              <li>{sharedDataCount.tasks} task{sharedDataCount.tasks !== 1 ? 's' : ''}</li>
              <li>{sharedDataCount.sections} section{sharedDataCount.sections !== 1 ? 's' : ''}</li>
              <li>{sharedDataCount.dependencies} dependenc{sharedDataCount.dependencies !== 1 ? 'ies' : 'y'}</li>
              {automationRuleCount > 0 && (
                <li>{automationRuleCount} automation rule{automationRuleCount !== 1 ? 's' : ''}</li>
              )}
            </ul>
          </div>

          {/* Include automations checkbox */}
          {automationRuleCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-automations"
                checked={includeAutomations}
                onCheckedChange={(checked) => setIncludeAutomations(checked === true)}
              />
              <label
                htmlFor="include-automations"
                className="text-sm cursor-pointer select-none"
              >
                Include automations
              </label>
            </div>
          )}

          {/* Options Explanation */}
          {hasCurrentData && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Replace:</strong> Remove all current data and load the shared data.
              </p>
              <p>
                <strong>Merge:</strong> Keep your data and add new items from the share.
              </p>
              <p>
                <strong>Cancel:</strong> Don&apos;t load anything.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleConfirm('cancel')}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {hasCurrentData && (
            <Button
              variant="destructive"
              onClick={() => handleConfirm('replace')}
              disabled={isLoading}
            >
              Replace All
            </Button>
          )}
          <Button
            onClick={() => handleConfirm(hasCurrentData ? 'merge' : 'replace')}
            disabled={isLoading}
          >
            {hasCurrentData ? 'Merge' : 'Load'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
