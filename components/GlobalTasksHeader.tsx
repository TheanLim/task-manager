'use client';

import { Button } from '@/components/ui/button';
import { Plus, List, ListTree } from 'lucide-react';
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
  const { globalTasksDisplayMode, setGlobalTasksDisplayMode } = useAppStore();

  return (
    <div className="flex items-center gap-4 mb-4">
      <h1 className="text-2xl font-bold">All Tasks</h1>
      
      <div className="ml-auto flex items-center gap-2">
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
  );
}
