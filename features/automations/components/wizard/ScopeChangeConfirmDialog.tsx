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

interface ScopeChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  removedProjects: Array<{ id: string; name: string }>;
  onConfirm: () => void;
}

const MAX_VISIBLE_PROJECTS = 4;

export function ScopeChangeConfirmDialog({
  open,
  onOpenChange,
  removedProjects,
  onConfirm,
}: ScopeChangeConfirmDialogProps) {
  const visibleProjects = removedProjects.slice(0, MAX_VISIBLE_PROJECTS);
  const remainingCount = removedProjects.length - MAX_VISIBLE_PROJECTS;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change rule scope?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <p>
                This rule is currently active in {removedProjects.length} projects.
                Saving will remove it from:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {visibleProjects.map((project) => (
                  <li key={project.id}>{project.name}</li>
                ))}
                {remainingCount > 0 && (
                  <li>… and {remainingCount} more</li>
                )}
              </ul>
              <p className="mt-2">In-flight automations in those projects will stop.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Save anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
