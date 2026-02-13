"use client";

import * as React from "react";
import { TabCoordinator } from "@/lib/tab-sync/TabCoordinator";
import { useTabSyncStore } from "@/lib/tab-sync/store";
import { generateTabId } from "@/lib/tab-sync/utils";
import { useDataStore } from "@/stores/dataStore";
import { useAppStore } from "@/stores/appStore";
import type { TabCoordinatorConfig } from "@/lib/tab-sync/types";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { ActiveTabIndicator } from "./ActiveTabIndicator";

export interface TabSyncProviderProps {
  /**
   * Child components to render
   */
  children: React.ReactNode;
  /**
   * Optional configuration for the TabCoordinator
   */
  config?: Partial<TabCoordinatorConfig>;
}

/**
 * TabSyncProvider component
 * 
 * Provides tab synchronization functionality to the application.
 * Initializes the TabCoordinator, manages its lifecycle, and renders
 * appropriate UI indicators based on the tab's active/read-only status.
 * 
 * This component should wrap the entire application to enable multi-tab
 * synchronization features.
 * 
 * Requirements: 1.1, 1.2, 7.1, 7.3
 */
const TabSyncCoordinatorContext = React.createContext<{
  coordinatorRef: React.MutableRefObject<TabCoordinator | null>;
  initialized: boolean;
} | null>(null);

/**
 * Inner component that handles banners — isolated so its state changes
 * don't re-render the children tree.
 */
const TabSyncBanners: React.FC = () => {
  const ctx = React.useContext(TabSyncCoordinatorContext);
  const isActiveTab = useTabSyncStore(s => s.isActiveTab);
  const isReadOnly = useTabSyncStore(s => s.isReadOnly);
  const storeForceTakeover = useTabSyncStore(s => s.forceTakeover);
  const [showActiveBanner, setShowActiveBanner] = React.useState(false);
  const [hasSeenOtherTabs, setHasSeenOtherTabs] = React.useState(false);

  const initialized = ctx?.initialized ?? false;

  React.useEffect(() => {
    if (initialized && isReadOnly) {
      setHasSeenOtherTabs(true);
    }
  }, [initialized, isReadOnly]);

  React.useEffect(() => {
    if (isActiveTab && hasSeenOtherTabs) {
      setShowActiveBanner(true);
      const timer = setTimeout(() => setShowActiveBanner(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowActiveBanner(false);
  }, [isActiveTab, hasSeenOtherTabs]);

  const handleTakeControl = React.useCallback(() => {
    if (ctx?.coordinatorRef.current) {
      ctx.coordinatorRef.current.forceTakeover();
    }
    storeForceTakeover();
  }, [storeForceTakeover, ctx]);

  return (
    <>
      {initialized && isReadOnly && <ReadOnlyBanner onTakeControl={handleTakeControl} />}
      {showActiveBanner && <ActiveTabIndicator />}
    </>
  );
};

export const TabSyncProvider: React.FC<TabSyncProviderProps> = ({
  children,
  config,
}) => {
  const coordinatorRef = React.useRef<TabCoordinator | null>(null);
  const tabIdRef = React.useRef<string>(generateTabId());
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    const store = useTabSyncStore.getState();
    const coordinator = new TabCoordinator(config, store, tabIdRef.current);
    coordinatorRef.current = coordinator;
    coordinator.initialize();
    setInitialized(true);

    return () => {
      if (coordinatorRef.current) {
        coordinatorRef.current.cleanup();
        coordinatorRef.current = null;
      }
    };
  }, [config]);

  // Cross-tab data sync for read-only tabs
  React.useEffect(() => {
    const PERSIST_KEYS = ['task-management-data', 'task-management-settings'];

    const handleStorageSync = (e: StorageEvent) => {
      if (!e.key || !PERSIST_KEYS.includes(e.key) || !e.newValue) return;
      if (useTabSyncStore.getState().isActiveTab) return;

      try {
        const parsed = JSON.parse(e.newValue);
        const stateData = parsed?.state;
        if (!stateData) return;

        if (e.key === 'task-management-data') {
          useDataStore.setState({
            projects: stateData.projects ?? [],
            tasks: stateData.tasks ?? [],
            sections: stateData.sections ?? [],
            dependencies: stateData.dependencies ?? [],
          });
        } else if (e.key === 'task-management-settings') {
          useAppStore.setState({
            settings: stateData.settings ?? useAppStore.getState().settings,
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  const ctxValue = React.useMemo(() => ({ coordinatorRef, initialized }), [initialized]);

  return (
    <TabSyncCoordinatorContext.Provider value={ctxValue}>
      <TabSyncBanners />
      {children}
    </TabSyncCoordinatorContext.Provider>
  );
};
