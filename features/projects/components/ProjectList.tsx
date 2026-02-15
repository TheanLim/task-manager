'use client';

import { Plus, FolderOpen, ListTodo } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

const DOT_COLORS = [
  'bg-amber-500', 'bg-teal-500', 'bg-rose-500', 'bg-violet-500',
  'bg-sky-500', 'bg-emerald-500', 'bg-orange-500', 'bg-indigo-500'
];

interface ProjectListProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onNewProject: () => void;
}

/**
 * Component to display list of projects
 */
export function ProjectList({
  projects,
  activeProjectId,
  onProjectSelect,
  onNewProject
}: ProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get('view');
  const isGlobalTasksActive = viewFromUrl === 'tasks';

  const handleProjectClick = (projectId: string) => {
    // Update URL with project query parameter and default to list view
    router.push(`/?project=${projectId}&tab=list`);
    // Also call the callback for any additional logic
    onProjectSelect(projectId);
  };

  const handleTasksClick = () => {
    router.push('/?view=tasks');
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Tasks Section */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">Tasks</h2>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer px-2 py-1.5 transition-colors rounded-md border-l-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isGlobalTasksActive
                ? "border-l-accent-brand bg-accent/50"
                : "border-l-transparent bg-accent/30 hover:bg-accent"
            )}
            onClick={handleTasksClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTasksClick(); } }}
          >
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              <h3 className="font-semibold text-sm">All Tasks</h3>
            </div>
          </div>
        </div>

        {/* Horizontal separator */}
        <div className="border-b" />

        {/* Projects Section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Projects</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onNewProject} size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create new project</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Start your first project"
              description="Create a project to organize your tasks and track progress"
              actionLabel="Create Project"
              onAction={onNewProject}
            />
          ) : (
            <div className="space-y-0.5">
              {projects.map((project, index) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "cursor-pointer px-2 py-1.5 transition-colors rounded-md border-l-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeProjectId === project.id
                          ? "border-l-accent-brand bg-accent/50"
                          : "border-l-transparent hover:bg-accent"
                      )}
                      onClick={() => handleProjectClick(project.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProjectClick(project.id); } }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", DOT_COLORS[index % DOT_COLORS.length])} />
                        <h3 className="font-medium text-sm truncate">{project.name}</h3>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start">
                    <p>{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
