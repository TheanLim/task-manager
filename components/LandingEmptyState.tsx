'use client';

import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingEmptyStateProps {
  onNewProject: () => void;
  onImport: () => void;
}

export function LandingEmptyState({ onNewProject, onImport }: LandingEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="bg-accent rounded-2xl p-4 mb-6">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Welcome to Tasks</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create a project to organize your tasks, or import existing data
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={onNewProject}
          className="bg-accent-brand hover:bg-accent-brand-hover text-white"
        >
          Create Project
        </Button>
        <Button variant="outline" onClick={onImport}>
          Import from JSON
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        Press <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">?</kbd> for keyboard shortcuts
      </p>
    </div>
  );
}
