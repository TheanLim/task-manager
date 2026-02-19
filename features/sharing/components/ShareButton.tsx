'use client';

import { useState } from 'react';
import { Share, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ShareService } from '@/features/sharing/services/shareService';
import { useDataStore, automationRuleRepository } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { TMSState, Task } from '@/types';

export interface ShareButtonProps {
  projectId?: string;
  projectName?: string;
  onShareSuccess?: (url: string) => void;
  onShareError?: (error: string) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  variant?: 'dropdown' | 'button';
}

export function ShareButton({ 
  projectId,
  projectName,
  onShareSuccess, 
  onShareError, 
  onShowToast,
  variant = 'dropdown'
}: ShareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [includeAutomations, setIncludeAutomations] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Get current state from Zustand stores
  const dataStore = useDataStore();
  const appStore = useAppStore();
  const tmsStore = useTMSStore();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    onShowToast?.(message, type);
  };
  
  const filterTMSForProject = (tmsState: TMSState, projectTasks: Task[]) => {
    const taskIds = new Set(projectTasks.map((t: Task) => t.id));
    
    return {
      activeSystem: tmsState.activeSystem,
      dit: {
        todayTasks: tmsState.dit.todayTasks.filter((id: string) => taskIds.has(id)),
        tomorrowTasks: tmsState.dit.tomorrowTasks.filter((id: string) => taskIds.has(id)),
        lastDayChange: tmsState.dit.lastDayChange
      },
      af4: {
        markedTasks: tmsState.af4.markedTasks.filter((id: string) => taskIds.has(id)),
        markedOrder: tmsState.af4.markedOrder.filter((id: string) => taskIds.has(id))
      },
      fvp: {
        dottedTasks: tmsState.fvp.dottedTasks.filter((id: string) => taskIds.has(id)),
        currentX: taskIds.has(tmsState.fvp.currentX || '') ? tmsState.fvp.currentX : null,
        selectionInProgress: tmsState.fvp.selectionInProgress
      }
    };
  };

  const handleShare = async () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmShare = async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    
    try {
      let currentState;
      
      if (projectId) {
        // Share only the specified project
        const project = dataStore.projects.find(p => p.id === projectId);
        const projectTasks = dataStore.tasks.filter(t => t.projectId === projectId);
        const projectSections = dataStore.sections.filter(s => s.projectId === projectId);
        const taskIds = new Set(projectTasks.map(t => t.id));
        const projectDeps = dataStore.dependencies.filter(d => 
          taskIds.has(d.blockingTaskId) && taskIds.has(d.blockedTaskId)
        );
        
        currentState = {
          projects: project ? [project] : [],
          tasks: projectTasks,
          sections: projectSections,
          dependencies: projectDeps,
          tmsState: filterTMSForProject(tmsStore.state, projectTasks),
          settings: appStore.settings,
          version: '1.0.0'
        };
        
        console.log(`[ShareButton] Sharing project "${projectName}" with ${projectTasks.length} tasks`);
      } else {
        // Share all data
        currentState = {
          projects: dataStore.projects,
          tasks: dataStore.tasks,
          sections: dataStore.sections,
          dependencies: dataStore.dependencies,
          tmsState: tmsStore.state,
          settings: appStore.settings,
          version: '1.0.0'
        };
        
        console.log(`[ShareButton] Sharing all data: ${dataStore.projects.length} projects, ${dataStore.tasks.length} tasks`);
      }
      
      const shareService = new ShareService(undefined, automationRuleRepository);
      const result = await shareService.generateShareURL(currentState, { includeAutomations });
      
      if (!result.success) {
        showToast(result.error || 'Failed to generate share URL', 'error');
        onShareError?.(result.error || 'Unknown error');
        setIsLoading(false);
        return;
      }
      
      if (!result.url) {
        showToast('No URL generated', 'error');
        setIsLoading(false);
        return;
      }
      
      // Show warning if URL is long
      if (result.warning) {
        showToast(result.warning, 'info');
      }
      
      setShareUrl(result.url);
      
      // Try to copy to clipboard
      const copiedSuccess = await shareService.copyToClipboard(result.url);
      
      if (copiedSuccess) {
        showToast('✓ Share URL copied to clipboard!');
        onShareSuccess?.(result.url);
      } else {
        // Show dialog for manual copy
        setShowDialog(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(errorMessage, 'error');
      onShareError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('✓ Share URL copied to clipboard!');
    } catch {
      // Fallback: select the text
      const input = document.querySelector('input[value="' + shareUrl + '"]') as HTMLInputElement;
      if (input) {
        input.select();
      }
    }
  };

  return (
    <>
      {variant === 'button' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Share className="mr-2 h-4 w-4" />
          )}
          Share Project
        </Button>
      ) : (
        <DropdownMenuItem onClick={handleShare} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Share className="mr-2 h-4 w-4" />
          )}
          {projectId ? 'Share Current Project' : 'Share All Projects'}
        </DropdownMenuItem>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Options</DialogTitle>
            <DialogDescription>
              Choose what to include when sharing {projectId ? 'this project' : 'your data'}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Checkbox
              id="export-include-automations"
              checked={includeAutomations}
              onCheckedChange={(checked) => setIncludeAutomations(checked === true)}
            />
            <label
              htmlFor="export-include-automations"
              className="text-sm cursor-pointer select-none"
            >
              Include automations
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmShare}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share className="mr-2 h-4 w-4" />
              )}
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share URL</DialogTitle>
            <DialogDescription>
              Copy this URL to share your application state. Anyone with this link can view your projects and tasks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="flex-1"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            ⚠️ This URL contains your application data. Only share with trusted recipients.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
