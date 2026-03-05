'use client';

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
import { AlertCircle } from 'lucide-react';

interface DuplicateGlobalRuleWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRuleName: string;
  existingRuleId: string;
  onViewExisting: (ruleId: string) => void;
  onPromoteAnyway: () => void;
}

export function DuplicateGlobalRuleWarning({
  open,
  onOpenChange,
  existingRuleName,
  existingRuleId,
  onViewExisting,
  onPromoteAnyway,
}: DuplicateGlobalRuleWarningProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <AlertDialogTitle>Similar global rule exists</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                &ldquo;{existingRuleName}&rdquo; already does the same thing. Creating another may cause duplicate actions.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onViewExisting(existingRuleId)}
            className="bg-accent-brand hover:bg-accent-brand/90 text-white mr-2"
          >
            View existing rule
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onPromoteAnyway}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Promote anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
