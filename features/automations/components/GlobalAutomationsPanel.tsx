'use client';

import { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { RuleCard } from './RuleCard';
import { GlobalRulesBadge } from './GlobalRulesBadge';
import { RuleDialog } from './wizard/RuleDialog';
import { useGlobalAutomationRules } from '../hooks/useGlobalAutomationRules';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { formatRelativeTime } from '../services/preview/formatters';
import type { AutomationRule } from '../types';
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
import { buildRuleUpdates, buildNewRuleData } from '../services/rules/ruleSaveService';

/**
 * Top-level panel for managing global automation rules.
 * Rendered when appStore.activeView === 'global-automations'.
 */
export function GlobalAutomationsPanel() {
  const { rules, createRule, updateRule, deleteRule } = useGlobalAutomationRules();
  const { projects, sections } = useDataStore();
  const { highlightRuleId } = useAppStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'log'>('rules');

  const sortedRules = [...rules].sort((a, b) => a.order - b.order);
  const editingRule = editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null;

  // Collect all execution log entries across all global rules, sorted newest first
  const allLogEntries = sortedRules
    .flatMap((r) =>
      (r.recentExecutions ?? []).map((e) => ({
        ...e,
        ruleName: r.name,
        ruleId: r.id,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

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
    // Scroll to the rule's entries — handled by highlight state
    useAppStore.getState().setHighlightRuleId(ruleId);
  }, []);

  // No-op handlers for RuleCard props not applicable to global rules
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
        <Button
          size="sm"
          onClick={handleCreateNew}
          className="bg-accent-brand hover:bg-accent-brand/90 text-white shrink-0"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          + New Rule
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rules' | 'log')}>
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="log">Execution Log</TabsTrigger>
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
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  sections={sections}
                  projectId=""
                  isGlobal
                  onEdit={handleEdit}
                  onDuplicate={noop}
                  onDuplicateToProject={noop}
                  onDelete={handleDeleteClick}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Execution Log tab */}
        <TabsContent value="log" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Showing the {Math.min(allLogEntries.length, 100)} most recent entries.
          </p>
          {allLogEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executions yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-36">Time</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Rule</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-40">Project</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-32">Trigger</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allLogEntries.map((entry, idx) => {
                    const project = entry.firingProjectId
                      ? projects.find((p) => p.id === entry.firingProjectId)
                      : null;
                    const isSkipped = entry.executionType === 'skipped';

                    return (
                      <tr key={`${entry.ruleId}-${entry.timestamp}-${idx}`} className="border-t">
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
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm truncate max-w-[200px]">{entry.ruleName}</span>
                            <GlobalRulesBadge />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground truncate">
                          {project?.name ?? entry.firingProjectId ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate">
                          {entry.triggerDescription}
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
