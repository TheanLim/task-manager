'use client';

import { useState } from 'react';
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

export interface PromoteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
  projectName: string;
  onConfirm: (option: 'keep' | 'delete') => void;
}

export function PromoteConfirmDialog({
  open,
  onOpenChange,
  ruleName,
  projectName,
  onConfirm,
}: PromoteConfirmDialogProps) {
  const [selected, setSelected] = useState<'keep' | 'delete'>('keep');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>What should happen to the original rule?</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${ruleName}" in "${projectName}" was promoted. The original project rule still exists.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div role="radiogroup" aria-label="Original rule disposition" className="space-y-2">
          <button
            type="button"
            role="radio"
            aria-checked={selected === 'keep'}
            onClick={() => setSelected('keep')}
            className={`w-full text-left rounded-md border p-3 transition-colors ${
              selected === 'keep'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full border-2 ${
                  selected === 'keep' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}
              />
              <span className="text-sm font-medium">Keep the original rule</span>
            </div>
            <p className="mt-1 ml-6 text-xs text-muted-foreground">
              {`Both rules will run in "${projectName}". You can delete it manually later.`}
            </p>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={selected === 'delete'}
            onClick={() => setSelected('delete')}
            className={`w-full text-left rounded-md border p-3 transition-colors ${
              selected === 'delete'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full border-2 ${
                  selected === 'delete' ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}
              />
              <span className="text-sm font-medium">Delete the original rule</span>
            </div>
            <p className="mt-1 ml-6 text-xs text-muted-foreground">
              Only the new global rule will run.
            </p>
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(selected)}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
