'use client';

import { Plus, FolderOpen, ListTodo } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Project } from '@/types';

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
          <Card
            className={`
              cursor-pointer px-2 py-1.5 transition-colors hover:bg-accent border-0 shadow-none rounded-md
              ${isGlobalTasksActive ? 'bg-accent' : ''}
            `}
            onClick={handleTasksClick}
          >
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              <h3 className="font-medium text-sm">All Tasks</h3>
            </div>
          </Card>
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
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <Button onClick={onNewProject} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {projects.map((project) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <Card
                      className={`
                        cursor-pointer px-2 py-1.5 transition-colors hover:bg-accent border-0 shadow-none rounded-md
                        ${activeProjectId === project.id ? 'bg-accent' : ''}
                      `}
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    </Card>
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
