'use client';

import { ViewMode } from '@/types';
import { Button } from '@/components/ui/button';
import { List, LayoutGrid, Calendar } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';

interface ViewModeSelectorProps {
  projectId: string;
  currentViewMode: ViewMode;
}

export function ViewModeSelector({ projectId, currentViewMode }: ViewModeSelectorProps) {
  const { updateProject } = useDataStore();

  const handleViewModeChange = (viewMode: ViewMode) => {
    updateProject(projectId, { viewMode });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      <Button
        variant={currentViewMode === ViewMode.LIST ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleViewModeChange(ViewMode.LIST)}
        className="gap-2"
      >
        <List className="h-4 w-4" />
        List
      </Button>
      
      <Button
        variant={currentViewMode === ViewMode.BOARD ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleViewModeChange(ViewMode.BOARD)}
        className="gap-2"
      >
        <LayoutGrid className="h-4 w-4" />
        Board
      </Button>
      
      <Button
        variant={currentViewMode === ViewMode.CALENDAR ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleViewModeChange(ViewMode.CALENDAR)}
        className="gap-2"
      >
        <Calendar className="h-4 w-4" />
        Calendar
      </Button>
    </div>
  );
}
