import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { DryRunResult } from '../../services/rules/dryRunService';

interface DryRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DryRunResult;
}

export function DryRunDialog({ open, onOpenChange, result }: DryRunDialogProps) {
  const { matchingTasks, actionDescription, totalCount } = result;
  const hasMatches = totalCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Dry run preview">
        <DialogHeader>
          <DialogTitle>
            {hasMatches
              ? `This rule would affect ${totalCount} ${totalCount === 1 ? 'task' : 'tasks'}`
              : 'Dry Run Preview'}
          </DialogTitle>
          <DialogDescription>
            {hasMatches
              ? `Action: ${actionDescription}`
              : 'No tasks match the current rule configuration.'}
          </DialogDescription>
        </DialogHeader>

        {hasMatches ? (
          <ul className="max-h-60 overflow-y-auto space-y-1 pr-2">
            {matchingTasks.map((task) => (
              <li
                key={task.id}
                className="text-sm py-1 px-2 rounded bg-muted/50"
              >
                {task.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            This rule would not affect any tasks right now.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
