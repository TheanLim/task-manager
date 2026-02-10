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
  onConfirm: (mode: 'replace' | 'merge' | 'cancel') => void;
}

export function SharedStateDialog({
  open,
  onOpenChange,
  sharedState,
  currentState,
  onConfirm,
}: SharedStateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = (mode: 'replace' | 'merge' | 'cancel') => {
    if (mode === 'cancel') {
      onOpenChange(false);
      onConfirm('cancel');
      return;
    }

    setIsLoading(true);
    onConfirm(mode);
    // Loading state will be cleared by parent
  };

  const sharedDataCount = {
    projects: sharedState.projects.length,
    tasks: sharedState.tasks.length,
    sections: sharedState.sections.length,
    dependencies: sharedState.dependencies.length,
  };

  const hasCurrentData = 
    currentState.projects > 0 || 
    currentState.tasks > 0 || 
    currentState.sections > 0 || 
    currentState.dependencies > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load Shared Data</DialogTitle>
          <DialogDescription>
            {hasCurrentData
              ? 'You have existing data. How would you like to load the shared data?'
              : 'Load the shared data into your workspace?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Data */}
          {hasCurrentData && (
            <div className="rounded-md bg-muted p-4">
              <h4 className="mb-2 font-semibold text-sm">Your Current Data</h4>
              <ul className="space-y-1 text-sm">
                <li>{currentState.projects} project(s)</li>
                <li>{currentState.tasks} task(s)</li>
                <li>{currentState.sections} section(s)</li>
                <li>{currentState.dependencies} dependenc(ies)</li>
              </ul>
            </div>
          )}

          {/* Shared Data */}
          <div className="rounded-md bg-primary/10 p-4">
            <h4 className="mb-2 font-semibold text-sm">Shared Data</h4>
            <ul className="space-y-1 text-sm">
              <li>{sharedDataCount.projects} project(s)</li>
              <li>{sharedDataCount.tasks} task(s)</li>
              <li>{sharedDataCount.sections} section(s)</li>
              <li>{sharedDataCount.dependencies} dependenc(ies)</li>
            </ul>
          </div>

          {/* Options Explanation */}
          {hasCurrentData && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Replace:</strong> Delete all your current data and load the shared data.
              </p>
              <p>
                <strong>Merge:</strong> Keep your current data and add the shared data.
              </p>
              <p>
                <strong>Cancel:</strong> Don't load the shared data.
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
