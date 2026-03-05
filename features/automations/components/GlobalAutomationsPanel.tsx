'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, LayoutList, AlignJustify } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { RuleCard } from './RuleCard';
import { GlobalRulesBadge } from './GlobalRulesBadge';
import { ExecutionLogFilterBar } from './ExecutionLogFilterBar';
import { RuleDialog } from './wizard/RuleDialog';
import { useGlobalAutomationRules } from '../hooks/useGlobalAutomationRules';
import { useExecutionLogFilters } from '../hooks/useExecutionLogFilters';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { formatRelativeTime } from '../services/preview/formatters';
import type { AutomationRule } from '../types';
import type { EnrichedLogEntry } from '../services/preview/logFilterService';
import type { OutcomeFilter } from '../services/preview/logFilterService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Top-level panel for managing global automation rules.
 * Rendered when appStore.activeView === 'global-automations'.
 */
export function GlobalAutomationsPanel() {
  const { rules, createRule, updateRule, deleteRule } = useGlobalAutomationRules();
  const { projects, sections } = useDataStore();
  const { highlightRuleId } = useAppStore();
  const setHighlightRuleId = useAppStore((s) => s.setHighlightRuleId);
  const globalPanelCompact = useAppStore((s) => s.globalPanelCompact);
  const setGlobalPanelCompact = useAppStore((s) => s.setGlobalPanelCompact);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read query params on mount
  const initialTab = searchParams.get('tab') === 'log' ? 'log' : 'rules';
  const initialOutcome = (searchParams.get('outcome') as OutcomeFilter) || 'all';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'log'>(initialTab as 'rules' | 'log');
  // Tracks which rule is currently highlighted (for brief flash animation)
  const [flashRuleId, setFlashRuleId] = useState<string | null>(null);

  // When highlightRuleId is set (from deep-link), scroll to the rule, flash it, then clear
  useEffect(() => {
    if (!highlightRuleId) return;

    // Switch to rules tab
    setActiveTab('rules');

    // Small delay to let the tab render
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-rule-id="${highlightRuleId}"]`);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      setFlashRuleId(highlightRuleId);
      // Clear highlight after animation
      const clearTimer = setTimeout(() => {
        setFlashRuleId(null);
        setHighlightRuleId(null);
      }, 1500);
      return () => clearTimeout(clearTimer);
    }, 50);

    return () => clearTimeout(timer);
  }, [highlightRuleId, setHighlightRuleId]);

  const sortedRules = [...rules].sort((a, b) => a.order - b.order);
  const editingRule = editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null;

  // Collect all execution log entries across all global rules, sorted newest first
  const allLogEntries: EnrichedLogEntry[] = useMemo(() =>
    sortedRules
      .flatMap((r) =>
        (r.recentExecutions ?? []).map((e, idx) => ({
          ...e,
          id: `${r.id}-${idx}`,
          ruleName: r.name,
          ruleId: r.id,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules]
  );

  // Wire execution log filters
  const {
    filters,
    filteredEntries,
    hasActiveFilters,
    setRuleIds,
    setProjectIds,
    setOutcome,
    setDateRange,
    clearFilters,
  } = useExecutionLogFilters(allLogEntries, initialOutcome);

  // Skip count for amber badge on log tab
  const skipCount = allLogEntries.filter(e => e.executionType === 'skipped').length;

  // Collect unique rule names and project names for filter dropdowns
  const allRuleNames = useMemo(() =>
    sortedRules.map(r => ({ id: r.id, name: r.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules]
  );
  const allProjectNames = useMemo(() =>
    projects.map(p => ({ id: p.id, name: p.name })),
    [projects]
  );

  const handleCreateNew = useCallback(() => {
    setEditingRuleId(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((ruleId: string) => {
    setEditingRuleId(ruleId);
    setDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((ruleId: string) => {
    setRuleToDelete(ruleId);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (ruleToDelete) deleteRule(ruleToDelete);
    setRuleToDelete(null);
    setDeleteConfirmOpen(false);
  }, [ruleToDelete, deleteRule]);

  const handleToggle = useCallback(
    (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (rule) updateRule(ruleId, { enabled: !rule.enabled });
    },
    [rules, updateRule]
  );

  const handleDialogSave = useCallback(
    (data: Parameters<typeof createRule>[0] | { id: string; updates: Partial<AutomationRule> }) => {
      if ('id' in data) {
        updateRule(data.id, data.updates);
      } else {
        createRule(data);
      }
    },
    [createRule, updateRule]
  );

  const handleViewLog = useCallback((ruleId: string) => {
    setActiveTab('log');
    router.push(`/?view=automations&rule=${ruleId}`);
  }, [router]);

  const handleDuplicate = useCallback(
    (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;
      createRule({
        projectId: null,
        name: `${rule.name} (Copy)`,
        trigger: { ...rule.trigger },
        action: { ...rule.action },
        filters: rule.filters ? [...rule.filters] : [],
        enabled: rule.enabled,
        brokenReason: null,
        excludedProjectIds: rule.excludedProjectIds ? [...rule.excludedProjectIds] : [],
      } as any);
    },
    [rules, createRule]
  );

  // No-op handler for RuleCard props not applicable to global rules
  const noop = useCallback(() => {}, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-brand" aria-hidden="true" />
            Automations
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rules that run across all your projects automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            aria-label={globalPanelCompact ? 'Switch to expanded view' : 'Switch to compact view'}
            aria-pressed={globalPanelCompact}
            onClick={() => setGlobalPanelCompact(!globalPanelCompact)}
          >
            {globalPanelCompact ? (
              <>
                <LayoutList className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Expanded
              </>
            ) : (
              <>
                <AlignJustify className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Compact
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleCreateNew}
            className="bg-accent-brand hover:bg-accent-brand/90 text-white"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            + New Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rules' | 'log')}>
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5">
            Execution Log
            {skipCount > 0 && (
              <Badge
                variant="outline"
                className="ml-1 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
              >
                {skipCount} skipped
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Rules tab */}
        <TabsContent value="rules" className="mt-4">
          {sortedRules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No global rules yet"
              description="Create a rule once and it runs across all your projects."
              actionLabel="+ Create your first rule"
              onAction={handleCreateNew}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {sortedRules.map((rule) => (
                <div
                  key={rule.id}
                  data-rule-id={rule.id}
                  className={flashRuleId === rule.id
                    ? 'rounded-lg ring-2 ring-accent-brand ring-offset-1 transition-all duration-300'
                    : 'rounded-lg transition-all duration-300'
                  }
                >
                  <RuleCard
                    rule={rule}
                    sections={sections}
                    projectId=""
                    isGlobal
                    compact={globalPanelCompact}
                    allProjects={projects}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDuplicateToProject={noop}
                    onDelete={handleDeleteClick}
                    onToggle={handleToggle}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Execution Log tab */}
        <TabsContent value="log" className="mt-4">
          <ExecutionLogFilterBar
            filters={filters}
            onSetRuleIds={setRuleIds}
            onSetProjectIds={setProjectIds}
            onSetOutcome={setOutcome}
            onSetDateRange={setDateRange}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            filteredCount={filteredEntries.length}
            totalCount={allLogEntries.length}
          />
          <p className="text-xs text-muted-foreground my-3">
            Showing {filteredEntries.length} entries (filtered from {allLogEntries.length} total)
          </p>
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executions yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-36">Time</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground min-w-0">Rule</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-40">Project</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-40">Task</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => {
                    const project = entry.firingProjectId
                      ? projects.find((p) => p.id === entry.firingProjectId)
                      : null;
                    const isSkipped = entry.executionType === 'skipped';

                    return (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{formatRelativeTime(entry.timestamp)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{new Date(entry.timestamp).toLocaleString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <button
                              type="button"
                              onClick={() => router.push(`/?view=automations&rule=${entry.ruleId}`)}
                              className="text-sm font-medium hover:underline underline-offset-2 text-left break-words min-w-0"
                              title={entry.ruleName}
                            >
                              {entry.ruleName}
                            </button>
                            <GlobalRulesBadge />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground truncate">
                          {project?.name ?? entry.firingProjectId ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate">
                          {entry.taskName ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {isSkipped ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 cursor-default"
                                    aria-label={`Skipped — ${entry.skipReason ?? 'reason unknown'}`}
                                  >
                                    Skipped
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{entry.skipReason ?? 'Rule was skipped'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Fired</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rule Dialog — global mode */}
      <RuleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRuleId(null);
        }}
        projectId=""
        sections={sections}
        editingRule={editingRule}
        isGlobal
        allProjects={projects}
        allSections={sections}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this global rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This rule will stop running in all projects. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRuleToDelete(null); setDeleteConfirmOpen(false); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
