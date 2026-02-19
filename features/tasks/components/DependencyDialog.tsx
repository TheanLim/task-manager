'use client';

import { useState, useMemo } from 'react';
import { Task, UUID } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataStore } from '@/stores/dataStore';
import { DependencyResolverImpl } from '@/features/tasks/services/dependencyResolver';
import { v4 as uuidv4 } from 'uuid';

interface DependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function DependencyDialog({
  open,
  onOpenChange,
  task,
}: DependencyDialogProps) {
  const { tasks, dependencies, addDependency, getTasksByProjectId } = useDataStore();
  const [dependencyType, setDependencyType] = useState<'blocks' | 'blocked-by'>('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<UUID | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get tasks from the same project, or all tasks if task has no project
  const projectTasks = task.projectId ? getTasksByProjectId(task.projectId) : tasks.filter(t => !t.projectId);
  
  // Filter out the current task and already connected tasks
  const existingBlockingIds = dependencies
    .filter(d => d.blockedTaskId === task.id)
    .map(d => d.blockingTaskId);
  
  const existingBlockedIds = dependencies
    .filter(d => d.blockingTaskId === task.id)
    .map(d => d.blockedTaskId);

  const availableTasks = useMemo(() => {
    return projectTasks.filter(t => {
      if (t.id === task.id) return false;
      if (existingBlockingIds.includes(t.id)) return false;
      if (existingBlockedIds.includes(t.id)) return false;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return t.description.toLowerCase().includes(query);
      }
      
      return true;
    });
  }, [projectTasks, task.id, existingBlockingIds, existingBlockedIds, searchQuery]);

  const handleSubmit = () => {
    if (!selectedTaskId) {
      setError('Please select a task');
      return;
    }

    const resolver = new DependencyResolverImpl();
    
    // Determine blocking and blocked task IDs based on dependency type
    const blockingTaskId = dependencyType === 'blocks' ? task.id : selectedTaskId;
    const blockedTaskId = dependencyType === 'blocks' ? selectedTaskId : task.id;

    // Check for circular dependency
    const tempDependencies = [
      ...dependencies,
      {
        id: 'temp',
        blockingTaskId,
        blockedTaskId,
        createdAt: new Date().toISOString(),
      },
    ];

    if (resolver.hasCircularDependency(blockingTaskId, blockedTaskId, tempDependencies)) {
      setError('This dependency would create a circular dependency chain');
      return;
    }

    // Add the dependency
    addDependency({
      id: uuidv4(),
      blockingTaskId,
      blockedTaskId,
      createdAt: new Date().toISOString(),
    });

    // Reset and close
    setSelectedTaskId(null);
    setSearchQuery('');
    setError(null);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedTaskId(null);
    setSearchQuery('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Dependency</DialogTitle>
          <DialogDescription>
            Create a dependency relationship between tasks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dependency Type</Label>
            <Select
              value={dependencyType}
              onValueChange={(value) => setDependencyType(value as 'blocks' | 'blocked-by')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blocks">
                  This task blocks another task
                </SelectItem>
                <SelectItem value="blocked-by">
                  This task is blocked by another task
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Search Tasks</Label>
            <Input
              placeholder="Search for a task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Task</Label>
            <Select
              value={selectedTaskId || ''}
              onValueChange={(value) => {
                setSelectedTaskId(value);
                setError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a task" />
              </SelectTrigger>
              <SelectContent>
                {availableTasks.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No tasks available
                  </div>
                ) : (
                  availableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.description}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Dependency</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
