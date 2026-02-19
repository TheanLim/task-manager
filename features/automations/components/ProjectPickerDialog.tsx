'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataStore } from '@/stores/dataStore';

export interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeProjectId: string;
  onSelect: (projectId: string) => void;
}

export function ProjectPickerDialog({
  open,
  onOpenChange,
  excludeProjectId,
  onSelect,
}: ProjectPickerDialogProps) {
  const { projects } = useDataStore();

  const availableProjects = projects.filter(
    (p) => p.id !== excludeProjectId
  );

  const handleSelect = (projectId: string) => {
    onSelect(projectId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a project</DialogTitle>
          <DialogDescription>Choose a target project for this rule</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {availableProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No other projects available
            </p>
          ) : (
            availableProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {project.name}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
