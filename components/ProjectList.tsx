'use client';

import { Plus, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

  const handleProjectClick = (projectId: string) => {
    // Update URL with project query parameter
    router.push(`/?project=${projectId}`);
    // Also call the callback for any additional logic
    onProjectSelect(projectId);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No projects yet</p>
        <Button onClick={onNewProject} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Projects</h2>
        <Button onClick={onNewProject} size="sm" variant="ghost">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`
              cursor-pointer p-3 transition-colors hover:bg-accent
              ${activeProjectId === project.id ? 'bg-accent' : ''}
            `}
            onClick={() => handleProjectClick(project.id)}
          >
            <h3 className="font-medium">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
