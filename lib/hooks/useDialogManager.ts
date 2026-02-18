import { useState, useCallback } from 'react';
import { AppState } from '@/types';

// --- State types ---

export interface ProjectDialogState {
  open: boolean;
  editingProjectId: string | null;
}

export interface TaskDialogState {
  open: boolean;
  editingTaskId: string | null;
  sectionId: string | null;
  parentTaskId: string | null;
}

export interface DependencyDialogState {
  open: boolean;
}

export interface SharedStateDialogState {
  open: boolean;
  sharedState: AppState | null;
}

export interface TaskDetailPanelState {
  selectedTaskId: string | null;
  scrollToSubtasks: boolean;
  panelWidth: number;
  isResizing: boolean;
}

export interface LoadingToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export interface DialogManagerState {
  projectDialog: ProjectDialogState;
  taskDialog: TaskDialogState;
  dependencyDialog: DependencyDialogState;
  sharedStateDialog: SharedStateDialogState;
  taskDetailPanel: TaskDetailPanelState;
  loadingToast: LoadingToastState | null;
}

// --- Return type ---

export interface DialogManagerActions {
  // Project dialog
  openProjectDialog: (editingProjectId?: string | null) => void;
  closeProjectDialog: () => void;
  setProjectDialogOpen: (open: boolean) => void;

  // Task dialog
  openTaskDialog: (options?: { editingTaskId?: string | null; sectionId?: string | null; parentTaskId?: string | null }) => void;
  closeTaskDialog: () => void;
  setTaskDialogOpen: (open: boolean) => void;
  resetTaskDialogContext: () => void;

  // Dependency dialog
  openDependencyDialog: () => void;
  closeDependencyDialog: () => void;
  setDependencyDialogOpen: (open: boolean) => void;

  // Shared state dialog
  openSharedStateDialog: (sharedState: AppState) => void;
  closeSharedStateDialog: () => void;

  // Task detail panel
  selectTask: (taskId: string) => void;
  deselectTask: () => void;
  setScrollToSubtasks: (scroll: boolean) => void;
  setTaskPanelWidth: (width: number) => void;
  setIsResizingTaskPanel: (resizing: boolean) => void;

  // Loading toast
  showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  dismissToast: () => void;
}

export type UseDialogManagerReturn = DialogManagerState & DialogManagerActions;

// --- Constants ---

const DEFAULT_PANEL_WIDTH = 384;

// --- Hook ---

export function useDialogManager(): UseDialogManagerReturn {
  // Project dialog state
  const [projectDialogOpen, setProjectDialogOpenRaw] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpenRaw] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDialogSectionId, setTaskDialogSectionId] = useState<string | null>(null);
  const [taskDialogParentId, setTaskDialogParentId] = useState<string | null>(null);

  // Dependency dialog state
  const [dependencyDialogOpen, setDependencyDialogOpenRaw] = useState(false);

  // Shared state dialog
  const [sharedStateDialog, setSharedStateDialog] = useState<SharedStateDialogState>({
    open: false,
    sharedState: null,
  });

  // Task detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scrollToSubtasks, setScrollToSubtasksRaw] = useState(false);
  const [taskPanelWidth, setTaskPanelWidthRaw] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizingTaskPanel, setIsResizingTaskPanelRaw] = useState(false);

  // Loading toast
  const [loadingToast, setLoadingToast] = useState<LoadingToastState | null>(null);

  // --- Project dialog actions ---

  const openProjectDialog = useCallback((editId?: string | null) => {
    setEditingProjectId(editId ?? null);
    setProjectDialogOpenRaw(true);
  }, []);

  const closeProjectDialog = useCallback(() => {
    setProjectDialogOpenRaw(false);
    setEditingProjectId(null);
  }, []);

  const setProjectDialogOpen = useCallback((open: boolean) => {
    setProjectDialogOpenRaw(open);
    if (!open) {
      setEditingProjectId(null);
    }
  }, []);

  // --- Task dialog actions ---

  const openTaskDialog = useCallback((options?: {
    editingTaskId?: string | null;
    sectionId?: string | null;
    parentTaskId?: string | null;
  }) => {
    setEditingTaskId(options?.editingTaskId ?? null);
    setTaskDialogSectionId(options?.sectionId ?? null);
    setTaskDialogParentId(options?.parentTaskId ?? null);
    setTaskDialogOpenRaw(true);
  }, []);

  const closeTaskDialog = useCallback(() => {
    setTaskDialogOpenRaw(false);
    setEditingTaskId(null);
    setTaskDialogSectionId(null);
    setTaskDialogParentId(null);
  }, []);

  const setTaskDialogOpen = useCallback((open: boolean) => {
    setTaskDialogOpenRaw(open);
    if (!open) {
      setEditingTaskId(null);
      setTaskDialogSectionId(null);
      setTaskDialogParentId(null);
    }
  }, []);

  const resetTaskDialogContext = useCallback(() => {
    setTaskDialogSectionId(null);
    setTaskDialogParentId(null);
  }, []);

  // --- Dependency dialog actions ---

  const openDependencyDialog = useCallback(() => {
    setDependencyDialogOpenRaw(true);
  }, []);

  const closeDependencyDialog = useCallback(() => {
    setDependencyDialogOpenRaw(false);
  }, []);

  const setDependencyDialogOpen = useCallback((open: boolean) => {
    setDependencyDialogOpenRaw(open);
  }, []);

  // --- Shared state dialog actions ---

  const openSharedStateDialog = useCallback((sharedState: AppState) => {
    setSharedStateDialog({ open: true, sharedState });
  }, []);

  const closeSharedStateDialog = useCallback(() => {
    setSharedStateDialog({ open: false, sharedState: null });
  }, []);

  // --- Task detail panel actions ---

  const selectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setScrollToSubtasksRaw(false);
  }, []);

  const deselectTask = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const setScrollToSubtasks = useCallback((scroll: boolean) => {
    setScrollToSubtasksRaw(scroll);
  }, []);

  const setTaskPanelWidth = useCallback((width: number) => {
    setTaskPanelWidthRaw(width);
  }, []);

  const setIsResizingTaskPanel = useCallback((resizing: boolean) => {
    setIsResizingTaskPanelRaw(resizing);
  }, []);

  // --- Toast actions ---

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration?: number) => {
    setLoadingToast({ message, type, duration });
  }, []);

  const dismissToast = useCallback(() => {
    setLoadingToast(null);
  }, []);

  return {
    // State
    projectDialog: {
      open: projectDialogOpen,
      editingProjectId,
    },
    taskDialog: {
      open: taskDialogOpen,
      editingTaskId,
      sectionId: taskDialogSectionId,
      parentTaskId: taskDialogParentId,
    },
    dependencyDialog: {
      open: dependencyDialogOpen,
    },
    sharedStateDialog,
    taskDetailPanel: {
      selectedTaskId,
      scrollToSubtasks,
      panelWidth: taskPanelWidth,
      isResizing: isResizingTaskPanel,
    },
    loadingToast,

    // Actions
    openProjectDialog,
    closeProjectDialog,
    setProjectDialogOpen,
    openTaskDialog,
    closeTaskDialog,
    setTaskDialogOpen,
    resetTaskDialogContext,
    openDependencyDialog,
    closeDependencyDialog,
    setDependencyDialogOpen,
    openSharedStateDialog,
    closeSharedStateDialog,
    selectTask,
    deselectTask,
    setScrollToSubtasks,
    setTaskPanelWidth,
    setIsResizingTaskPanel,
    showToast,
    dismissToast,
  };
}
