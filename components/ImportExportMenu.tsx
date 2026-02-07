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
import { useTMSStore } from '@/stores/tmsStore';
import { useAppStore } from '@/stores/appStore';

export function ImportExportMenu() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    projects: number;
    tasks: number;
    sections: number;
    dependencies: number;
  } | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataStore = useDataStore();

  const storage = new LocalStorageAdapter();

  const handleExport = () => {
    try {
      const json = storage.exportToJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
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
        // Replace all data - save directly to storage and reload
        storage.save(importData);
        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);
        alert('Data imported successfully!');
        window.location.reload(); // Reload to load the new state
      } else {
        // Merge data - add items directly without creating default sections
        // We need to manually merge the arrays to avoid duplicate sections
        const currentProjects = dataStore.projects;
        const currentTasks = dataStore.tasks;
        const currentSections = dataStore.sections;
        const currentDependencies = dataStore.dependencies;
        
        // Use Zustand's internal setState to merge data
        useDataStore.setState({
          projects: [...currentProjects, ...importData.projects],
          tasks: [...currentTasks, ...importData.tasks],
          sections: [...currentSections, ...importData.sections],
          dependencies: [...currentDependencies, ...importData.dependencies]
        });
        
        setImportDialogOpen(false);
        setImportPreview(null);
        setImportData(null);
        alert('Data imported successfully!');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import data. Please try again.');
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
    </>
  );
}
