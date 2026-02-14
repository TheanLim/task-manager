'use client';

import { useState } from 'react';
import { TimeManagementSystem } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';

const TMS_DESCRIPTIONS = {
  [TimeManagementSystem.NONE]: {
    name: 'None',
    description: 'No time management system. Tasks are shown in their default order.',
  },
  [TimeManagementSystem.DIT]: {
    name: 'Do It Tomorrow (DIT)',
    description: 'Tasks are organized into "Today" and "Tomorrow" lists. At the end of each day, incomplete tasks roll over to tomorrow.',
  },
  [TimeManagementSystem.AF4]: {
    name: 'Autofocus 4 (AF4)',
    description: 'Mark tasks you want to work on. Marked tasks appear first, maintaining the order you marked them.',
  },
  [TimeManagementSystem.FVP]: {
    name: 'Final Version Perfected (FVP)',
    description: 'Compare tasks pairwise to build a prioritized list. Work through dotted tasks in reverse order.',
  },
};

export function TMSSelector() {
  const { settings, setTimeManagementSystem } = useAppStore();
  const { clearSystemMetadata } = useTMSStore();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSystem, setPendingSystem] = useState<TimeManagementSystem | null>(null);

  const handleSystemChange = (value: string) => {
    const newSystem = value as TimeManagementSystem;
    
    // If switching away from current system, show confirmation
    if (settings.timeManagementSystem !== TimeManagementSystem.NONE) {
      setPendingSystem(newSystem);
      setConfirmDialogOpen(true);
    } else {
      // No confirmation needed when switching from None
      setTimeManagementSystem(newSystem);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingSystem !== null) {
      // Clear metadata from previous system
      clearSystemMetadata();
      
      // Switch to new system
      setTimeManagementSystem(pendingSystem);
      
      // Reset state
      setPendingSystem(null);
      setConfirmDialogOpen(false);
    }
  };

  const handleCancelSwitch = () => {
    setPendingSystem(null);
    setConfirmDialogOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Time Management System</Label>
        <Select
          value={settings.timeManagementSystem}
          onValueChange={handleSystemChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TMS_DESCRIPTIONS).map(([key, { name }]) => (
              <SelectItem key={key} value={key}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {settings.timeManagementSystem !== TimeManagementSystem.NONE && (
          <p className="text-sm text-muted-foreground">
            {TMS_DESCRIPTIONS[settings.timeManagementSystem].description}
          </p>
        )}
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Time Management System?</DialogTitle>
            <DialogDescription>
              You are about to switch from{' '}
              <strong>{TMS_DESCRIPTIONS[settings.timeManagementSystem].name}</strong> to{' '}
              <strong>{pendingSystem && TMS_DESCRIPTIONS[pendingSystem].name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4">
              <h4 className="font-semibold text-sm mb-2">What will change:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>All system-specific metadata will be cleared</li>
                <li>Tasks will remain unchanged</li>
                <li>You can switch back at any time</li>
              </ul>
            </div>

            {pendingSystem && pendingSystem !== TimeManagementSystem.NONE && (
              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-semibold text-sm mb-2">New system:</h4>
                <p className="text-sm">{TMS_DESCRIPTIONS[pendingSystem].description}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSwitch}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSwitch}>
              Switch System
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
