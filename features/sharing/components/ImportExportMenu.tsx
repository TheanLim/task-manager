'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Upload, FileJson } from 'lucide-react';
import { importFromJSON } from '@/features/sharing/services/importExport';
import { deduplicateEntities } from '@/features/sharing/services/deduplicateData';
import { useDataStore, projectRepository, taskRepository, sectionRepository, dependencyRepository } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { toast as sonnerToast } from 'sonner';
import { Project, Task, Section, TaskDependency } from '@/types';
import { ShareButton } from '@/features/sharing/components/ShareButton';

export function ImportExportMenu() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    projects: number;
    tasks: number;
    sections: number;
    dependencies: number;
  } | null>(null);
  const [importData, setImportData] = useState<{
    projects: Project[];
    tasks: Task[];
    sections: Section[];
    dependencies: TaskDependency[];
  } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'success') sonnerToast.success(message);
    else if (type === 'error') sonnerToast.error(message);
    else sonnerToast.info(message);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataStore = useDataStore();
  const appStore = useAppStore();
  const tmsStore = useTMSStore();

  const handleExport = () => {
    try {
      // Get current state directly from Zustand stores (in-memory state)
      const state = {
        projects: dataStore.projects,
        tasks: dataStore.tasks,
        sections: dataStore.sections,
        dependencies: dataStore.dependencies,
        tmsState: tmsStore.state,
        settings: appStore.settings,
        version: '1.0.0',
        exportedAt: new Date().toISOString()
      };
      
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export data. Please try again.', 'error');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = importFromJSON(text);
      
      // Store the imported data
      setImportData(data);
      
      // Show preview
      setImportPreview({
        projects: data.projects.length,
        tasks: data.tasks.length,
        sections: data.sections.length,
        dependencies: data.dependencies.length
      });
      setImportError(null);
      setImportDialogOpen(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Invalid file format');
      setImportPreview(null);
      setImportData(null);
      setImportDialogOpen(true);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = (mode: 'replace' | 'merge') => {
    if (!importPreview || !importData) return;

    try {
      if (mode === 'replace') {
        // Replace all data via repositories — keeps backend, localStorage,
        // and Zustand store in sync without a page reload.
        projectRepository.replaceAll(importData.projects);
        taskRepository.replaceAll(importData.tasks);
        sectionRepository.replaceAll(importData.sections);
        dependencyRepository.replaceAll(importData.dependencies);
        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);
        showToast('Data imported successfully!', 'success');
      } else {
        // Merge: deduplicate existing, filter new, write through repositories
        const current = {
          projects: dataStore.projects,
          tasks: dataStore.tasks,
          sections: dataStore.sections,
          dependencies: dataStore.dependencies,
        };

        // Deduplicate existing data
        const { deduplicated, removedCount: cleanedCount } = deduplicateEntities(current);

        // Filter imported entities that already exist
        const existingIds = {
          projects: new Set(deduplicated.projects.map(p => p.id)),
          tasks: new Set(deduplicated.tasks.map(t => t.id)),
          sections: new Set(deduplicated.sections.map(s => s.id)),
          dependencies: new Set(deduplicated.dependencies.map(d => d.id)),
        };

        const newProjects = importData.projects.filter(p => !existingIds.projects.has(p.id));
        const newTasks = importData.tasks.filter(t => !existingIds.tasks.has(t.id));
        const newSections = importData.sections.filter(s => !existingIds.sections.has(s.id));
        const newDependencies = importData.dependencies.filter(d => !existingIds.dependencies.has(d.id));

        // Write merged data through repositories (keeps backend + store in sync)
        projectRepository.replaceAll([...deduplicated.projects, ...newProjects]);
        taskRepository.replaceAll([...deduplicated.tasks, ...newTasks]);
        sectionRepository.replaceAll([...deduplicated.sections, ...newSections]);
        dependencyRepository.replaceAll([...deduplicated.dependencies, ...newDependencies]);

        const addedCount = newProjects.length + newTasks.length + newSections.length + newDependencies.length;
        const skippedCount =
          (importData.projects.length - newProjects.length) +
          (importData.tasks.length - newTasks.length) +
          (importData.sections.length - newSections.length) +
          (importData.dependencies.length - newDependencies.length);

        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);

        if (cleanedCount > 0 && skippedCount > 0) {
          showToast(`Merged ${addedCount} items (${skippedCount} duplicates skipped, ${cleanedCount} existing duplicates cleaned)`, 'info');
        } else if (cleanedCount > 0) {
          showToast(`Merged ${addedCount} items (${cleanedCount} existing duplicates cleaned)`, 'info');
        } else if (skippedCount > 0) {
          showToast(`Merged ${addedCount} items (${skippedCount} duplicates skipped)`, 'info');
        } else {
          showToast('Data merged successfully!', 'success');
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Failed to import data. Please try again.', 'error');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileJson className="mr-2 h-4 w-4" />
            Data
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </DropdownMenuItem>
          <ShareButton 
            onShowToast={(message, type) => showToast(message, type)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        id="import-file-input"
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              {importError
                ? 'There was an error importing your data.'
                : 'Choose how to import your data.'}
            </DialogDescription>
          </DialogHeader>

          {importError ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {importError}
            </div>
          ) : importPreview ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h4 className="mb-2 font-semibold">Import Preview</h4>
                <ul className="space-y-1 text-sm">
                  <li>{importPreview.projects} project(s)</li>
                  <li>{importPreview.tasks} task(s)</li>
                  <li>{importPreview.sections} section(s)</li>
                  <li>{importPreview.dependencies} dependenc(ies)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Replace:</strong> Delete all existing data and import new data.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Merge:</strong> Keep existing data and add imported data.
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            {!importError && importPreview && (
              <>
                <Button variant="destructive" onClick={() => handleImportConfirm('replace')}>
                  Replace All
                </Button>
                <Button onClick={() => handleImportConfirm('merge')}>
                  Merge
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
