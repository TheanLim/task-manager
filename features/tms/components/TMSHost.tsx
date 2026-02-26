/**
 * TMSHost — wires dispatch, lifecycle, and error boundaries for TMS views.
 *
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §3; UI-UX-DESIGN.md §12 "TMSHost"
 * Requirements: 4.3
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Task } from '@/types';
import { useTMSStore } from '../stores/tmsStore';
import { useTMSStoreHydrated } from '../hooks/useTMSStoreHydrated';
import { getTMSHandler, getAllTMSHandlers } from '../registry';
import { TMSTabBar } from './TMSTabBar';
import { TMSGuide, TMSGuideHelpButton } from './shared/TMSGuide';
import { useTMSSystemState } from '../hooks/useTMSSystemState';
import { useTMSGuide } from '../hooks/useTMSGuide';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TMSHostProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TMSErrorBoundary extends React.Component<
  { children: React.ReactNode; systemId: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; systemId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[TMSHost] Error in system "${this.props.systemId}":`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
            ⚠
          </div>
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            This system encountered an error. Switch to another system or reload the page.
          </p>
          <button
            className="text-xs text-primary underline mt-1"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── TMSHost ───────────────────────────────────────────────────────────────────

export function TMSHost({ tasks, onTaskClick, onTaskComplete }: TMSHostProps) {
  const { state, applySystemStateDelta, setActiveSystem, setSystemState } = useTMSStore();
  const hydrated = useTMSStoreHydrated();
  const [resumedSystemId, setResumedSystemId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const resumedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRolloverToastDateRef = useRef<string | null>(null);

  // Show DIT day rollover toast — once per calendar day
  const showRolloverToastIfNeeded = useCallback((delta: Record<string, unknown>) => {
    if (delta.todayTasks === undefined) return;
    const today = new Date().toISOString().slice(0, 10);
    if (lastRolloverToastDateRef.current === today) return;
    lastRolloverToastDateRef.current = today;
    sonnerToast.info("Good morning! Yesterday's Tomorrow is now Today.");
  }, []);

  // Resolve the active handler and system state via hook
  const activeSystemId = state.activeSystem;
  const { handler, systemState } = useTMSSystemState(activeSystemId);
  const { isVisible: guideVisible, dismiss: dismissGuide, reopen: reopenGuide } = useTMSGuide(activeSystemId);

  // Build dispatch — calls handler.reduce then applySystemStateDelta
  const dispatch = useCallback(
    (action: unknown) => {
      const delta = handler.reduce(systemState, action);
      applySystemStateDelta(handler.id, delta as Record<string, unknown>);
    },
    [handler, systemState, applySystemStateDelta],
  );

  // System switching lifecycle
  const handleSwitch = useCallback(
    (newSystemId: string) => {
      if (newSystemId === activeSystemId) return;

      // Start transition animation
      setTransitioning(true);
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      // 1. Deactivate current system — persist clean state
      const deactivateDelta = handler.onDeactivate(systemState);
      applySystemStateDelta(handler.id, deactivateDelta as Record<string, unknown>);

      // 2. Switch active system
      setActiveSystem(newSystemId);

      // 3. Activate new system
      const newHandler = getTMSHandler(newSystemId);
      const existingState = state.systemStates[newSystemId];
      const newRaw = existingState ?? newHandler.getInitialState();
      const newSystemState = newHandler.validateState(newRaw);
      const activateDelta = newHandler.onActivate(tasks, newSystemState);
      // Merge the activate delta with the full validated state and persist.
      // Using setSystemState (not applySystemStateDelta) ensures the store has
      // a complete state object that passes handler.validateState() on re-read.
      const mergedState = { ...(newSystemState as Record<string, unknown>), ...(activateDelta as Record<string, unknown>) };
      setSystemState(newSystemId, mergedState);

      // 4. Show DIT day rollover toast if applicable
      if (newSystemId === 'dit') {
        showRolloverToastIfNeeded(activateDelta as Record<string, unknown>);
      }

      // 5. Set resumedSystemId if the new system already had state
      if (existingState !== undefined) {
        // Clear any existing timer
        if (resumedTimerRef.current) {
          clearTimeout(resumedTimerRef.current);
        }
        setResumedSystemId(newSystemId);
        resumedTimerRef.current = setTimeout(() => {
          setResumedSystemId(null);
        }, 3000);
      } else {
        setResumedSystemId(null);
      }

      // End transition animation after 150ms
      transitionTimerRef.current = setTimeout(() => {
        setTransitioning(false);
      }, 150);
    },
    [handler, systemState, state.activeSystem, activeSystemId, state.systemStates, applySystemStateDelta, setActiveSystem, setSystemState, tasks, showRolloverToastIfNeeded],
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (resumedTimerRef.current) {
        clearTimeout(resumedTimerRef.current);
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // On initial mount, if DIT is active, run onActivate to check for day rollover
  const initialMountRef = useRef(true);
  useEffect(() => {
    if (!hydrated || !initialMountRef.current) return;
    initialMountRef.current = false;
    if (activeSystemId === 'dit') {
      const activateDelta = handler.onActivate(tasks, systemState);
      const deltaRecord = activateDelta as Record<string, unknown>;
      // Always persist the full merged state so validateState succeeds on re-read
      const mergedState = { ...(systemState as Record<string, unknown>), ...deltaRecord };
      setSystemState(handler.id, mergedState);
      showRolloverToastIfNeeded(deltaRecord);
    }
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const ViewComponent = handler.getViewComponent();

  // Wait for store hydration before rendering — prevents flash of default state
  if (!hydrated) {
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <TMSTabBar
              activeSystemId={activeSystemId}
              onSwitch={handleSwitch}
              resumedSystemId={resumedSystemId ?? undefined}
            />
          </div>
          {!guideVisible && (
            <div className="pt-2">
              <TMSGuideHelpButton onClick={reopenGuide} />
            </div>
          )}
        </div>
        {guideVisible && (
          <TMSGuide systemId={activeSystemId} onDismiss={dismissGuide} />
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <TMSErrorBoundary systemId={activeSystemId}>
          <div className={`motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out ${
            transitioning ? 'opacity-0 translate-y-1.5' : 'opacity-100 translate-y-0'
          }`}>
            <ViewComponent
              tasks={tasks}
              systemState={systemState}
              dispatch={dispatch}
              onTaskClick={onTaskClick}
              onTaskComplete={onTaskComplete}
            />
          </div>
        </TMSErrorBoundary>
      </div>
    </div>
  );
}
