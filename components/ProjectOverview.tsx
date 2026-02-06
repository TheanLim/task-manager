'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Task } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
import { InlineEditable } from '@/components/InlineEditable';
import { validateProjectName } from '@/lib/validation';
import { format } from 'date-fns';

interface ProjectOverviewProps {
  project: Project;
  tasks: Task[];
  onUpdateProject: (updates: Partial<Project>) => void;
  onDeleteProject: () => void;
}

export function ProjectOverview({
  project,
  tasks,
  onUpdateProject,
  onDeleteProject
}: ProjectOverviewProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [description, setDescription] = useState(project.description || '');

  const completedTasks = tasks.filter(t => t.completed);
  const incompleteTasks = tasks.filter(t => !t.completed);

  const handleDescriptionBlur = () => {
    if (description !== project.description) {
      onUpdateProject({ description });
    }
  };

  const handleDelete = () => {
    onDeleteProject();
    setDeleteDialogOpen(false);
    router.push('/');
  };

  return (
    <div className="space-y-8 p-6">
      {/* Project Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Name - inline editable */}
          <div>
            <Label>Project Name</Label>
            <InlineEditable
              value={project.name}
              onSave={(name) => onUpdateProject({ name })}
              validate={validateProjectName}
              placeholder="Project name"
              displayClassName="text-base"
              inputClassName="text-base"
            />
          </div>
          
          {/* Project Description - textarea */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a project description..."
              className="mt-2 min-h-[100px]"
            />
          </div>
          
          {/* Project Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2 font-medium">
                {format(new Date(project.createdAt), 'PPP')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="ml-2 font-medium">
                {format(new Date(project.updatedAt), 'PPP')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Tasks:</span>
              <span className="ml-2 font-medium">{tasks.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Completed:</span>
              <span className="ml-2 font-medium">
                {completedTasks.length} ({tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">In Progress:</span>
              <span className="ml-2 font-medium">{incompleteTasks.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Danger Zone Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that will permanently affect this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Project
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project
              &quot;{project.name}&quot; and all {tasks.length} associated task{tasks.length !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
