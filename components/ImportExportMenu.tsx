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
import { LocalStorageAdapter } from '@/lib/storage';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/stores/tmsStore';
import { Toast } from '@/components/ui/toast';
import { Project, Task, Section, TaskDependency, AppState } from '@/types';
import { ShareButton } from '@/components/ShareButton';

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataStore = useDataStore();
  const appStore = useAppStore();
  const tmsStore = useTMSStore();

  const storage = new LocalStorageAdapter();

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
      setToast({ message: 'Data exported successfully!', type: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      setToast({ message: 'Failed to export data. Please try again.', type: 'error' });
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
      const data = storage.importFromJSON(text);
      
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
        // Replace all data - construct full AppState and save
        const currentState = storage.load();
        const newState = {
          ...currentState,
          projects: importData.projects,
          tasks: importData.tasks,
          sections: importData.sections,
          dependencies: importData.dependencies,
        };
        storage.save(newState as AppState);
        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);
        setToast({ message: 'Data imported successfully! Reloading...', type: 'success' });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        // Merge data - filter out duplicates by ID
        const currentProjects = dataStore.projects;
        const currentTasks = dataStore.tasks;
        const currentSections = dataStore.sections;
        const currentDependencies = dataStore.dependencies;
        
        // Deduplicate existing data first
        const uniqueProjects = Array.from(new Map(currentProjects.map(p => [p.id, p])).values());
        const uniqueTasks = Array.from(new Map(currentTasks.map(t => [t.id, t])).values());
        const uniqueSections = Array.from(new Map(currentSections.map(s => [s.id, s])).values());
        const uniqueDependencies = Array.from(new Map(currentDependencies.map(d => [d.id, d])).values());
        
        // Filter out duplicates from imported data
        const existingProjectIds = new Set(uniqueProjects.map(p => p.id));
        const existingTaskIds = new Set(uniqueTasks.map(t => t.id));
        const existingSectionIds = new Set(uniqueSections.map(s => s.id));
        const existingDependencyIds = new Set(uniqueDependencies.map(d => d.id));
        
        const newProjects = importData.projects.filter(p => !existingProjectIds.has(p.id));
        const newTasks = importData.tasks.filter(t => !existingTaskIds.has(t.id));
        const newSections = importData.sections.filter(s => !existingSectionIds.has(s.id));
        const newDependencies = importData.dependencies.filter(d => !existingDependencyIds.has(d.id));
        
        // Use Zustand's internal setState to merge data
        useDataStore.setState({
          projects: [...uniqueProjects, ...newProjects],
          tasks: [...uniqueTasks, ...newTasks],
          sections: [...uniqueSections, ...newSections],
          dependencies: [...uniqueDependencies, ...newDependencies]
        });
        
        const addedCount = newProjects.length + newTasks.length + newSections.length + newDependencies.length;
        const skippedCount = 
          (importData.projects.length - newProjects.length) +
          (importData.tasks.length - newTasks.length) +
          (importData.sections.length - newSections.length) +
          (importData.dependencies.length - newDependencies.length);
        
        const cleanedCount = 
          (currentProjects.length - uniqueProjects.length) +
          (currentTasks.length - uniqueTasks.length) +
          (currentSections.length - uniqueSections.length) +
          (currentDependencies.length - uniqueDependencies.length);
        
        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);
        
        if (cleanedCount > 0 && skippedCount > 0) {
          setToast({ 
            message: `Merged ${addedCount} items (${skippedCount} duplicates skipped, ${cleanedCount} existing duplicates cleaned)`, 
            type: 'info' 
          });
        } else if (cleanedCount > 0) {
          setToast({ 
            message: `Merged ${addedCount} items (${cleanedCount} existing duplicates cleaned)`, 
            type: 'info' 
          });
        } else if (skippedCount > 0) {
          setToast({ 
            message: `Merged ${addedCount} items (${skippedCount} duplicates skipped)`, 
            type: 'info' 
          });
        } else {
          setToast({ message: 'Data merged successfully!', type: 'success' });
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      setToast({ message: 'Failed to import data. Please try again.', type: 'error' });
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
            onShowToast={(message, type) => setToast({ message, type })}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
