'use client';

import { Button } from '@/components/ui/button';
import { Plus, List, ListTree, ListChecks, Eye, Info, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GlobalTasksHeaderProps {
  onAddTask: () => void;
}

/**
 * Header component for Global Tasks View
 * Includes display mode toggle and add task button
 */
export function GlobalTasksHeader({ onAddTask }: GlobalTasksHeaderProps) {
  const { globalTasksDisplayMode, setGlobalTasksDisplayMode, needsAttentionSort, setNeedsAttentionSort, hideCompletedTasks, setHideCompletedTasks } = useAppStore();

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        
        <div className="ml-auto flex items-center gap-2">
          {/* Needs Attention sort toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={needsAttentionSort ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNeedsAttentionSort(!needsAttentionSort)}
                >
                  {needsAttentionSort ? <Eye className="h-4 w-4 mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />}
                  {needsAttentionSort ? 'Reviewing' : 'Review Queue'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {needsAttentionSort
                    ? 'Reviewing tasks — oldest-reviewed on top. Click ↻ to mark reviewed.'
                    : 'Sort by last reviewed — oldest first'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Hide completed toggle — only in Normal mode (Reviewing auto-hides) */}
          {!needsAttentionSort && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hideCompletedTasks ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHideCompletedTasks(!hideCompletedTasks)}
                  >
                    {hideCompletedTasks ? <EyeOff className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {hideCompletedTasks ? 'Completed hidden' : 'Hide completed'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{hideCompletedTasks ? 'Show completed tasks' : 'Hide completed tasks'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Display mode toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGlobalTasksDisplayMode(
                    globalTasksDisplayMode === 'nested' ? 'flat' : 'nested'
                  )}
                >
                  {globalTasksDisplayMode === 'nested' ? (
                    <>
                      <ListTree className="h-4 w-4 mr-2" />
                      Nested
                    </>
                  ) : (
                    <>
                      <List className="h-4 w-4 mr-2" />
                      Flat
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {globalTasksDisplayMode === 'nested' 
                    ? 'Switch to flat view (all tasks at same level)' 
                    : 'Switch to nested view (subtasks indented)'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Add task button */}
          <Button onClick={onAddTask} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {needsAttentionSort && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {globalTasksDisplayMode === 'flat'
              ? 'Each task is sorted individually by last reviewed — subtasks appear on their own, not grouped under parents'
              : 'Sorted by last reviewed — task order here is independent of project views'}
          </span>
        </div>
      )}
    </>
  );
}
