'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { EmptyState } from '@/components/EmptyState';
import { RuleCard } from './RuleCard';
import { RuleDialog } from './wizard/RuleDialog';
import { DryRunDialog } from './schedule/DryRunDialog';
import { useAutomationRules } from '../hooks/useAutomationRules';
import { dryRunScheduledRule, type DryRunResult } from '../services/rules/dryRunService';
import { evaluateRules } from '../services/evaluation/ruleEngine';
import { isScheduledTrigger } from '../types';
import { useDataStore } from '@/stores/dataStore';
import { schedulerService, bulkScheduleService } from '@/lib/serviceContainer';
import type { Section } from '@/lib/schemas';

const MAX_RULES_WARNING_THRESHOLD = 10;

interface AutomationTabProps {
  projectId: string;
  sections: Section[];
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * AutomationTab component displays the automation rules for a project.
 * Shows an empty state when no rules exist, or a list of rule cards with CRUD operations.
 *
 * Validates Requirements: 2.1, 2.2, 2.3, 9.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export function AutomationTab({ projectId, sections, onShowToast }: AutomationTabProps) {
  const { rules, duplicateRule, duplicateToProject, deleteRule, toggleRule, reorderRules, bulkSetEnabled } = useAutomationRules(projectId);

  // Sort rules by order for display
  const sortedRules = [...rules].sort((a, b) => a.order - b.order);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const newIndex = sortedRules.findIndex((r) => r.id === over.id);
      if (newIndex !== -1) {
        reorderRules(active.id as string, newIndex);
      }
    },
    [sortedRules, reorderRules]
  );

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Track rule count before dialog opens to detect new rule creation
  const ruleCountBeforeDialog = useRef(rules.length);
  const wasDialogOpen = useRef(false);

  // Detect rule creation and show max rules warning toast
  useEffect(() => {
    if (wasDialogOpen.current && !isDialogOpen) {
      // Dialog just closed — check if a new rule was created
      if (rules.length > ruleCountBeforeDialog.current && rules.length >= MAX_RULES_WARNING_THRESHOLD) {
        onShowToast?.(
          'This project has 10 automation rules. Consider reviewing and consolidating.',
          'info'
        );
      }
    }
    wasDialogOpen.current = isDialogOpen;
    if (isDialogOpen) {
      ruleCountBeforeDialog.current = rules.length;
    }
  }, [isDialogOpen, rules.length, onShowToast]);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Get the rule being edited (clear fireAt when rescheduling a one-time rule)
  const editingRule = editingRuleId
    ? (() => {
        const rule = rules.find((r) => r.id === editingRuleId);
        if (!rule) return null;
        if (isRescheduling && rule.trigger.type === 'scheduled_one_time') {
          return {
            ...rule,
            enabled: true,
            trigger: {
              ...rule.trigger,
              schedule: { ...((rule.trigger as any).schedule), fireAt: '' },
              lastEvaluatedAt: null,
            },
          } as typeof rule;
        }
        return rule;
      })()
    : null;

  // Determine bulk toggle label: if any rules are enabled, show "Disable all"
  const hasEnabledRules = rules.some((r) => r.enabled);

  // Compute scheduled vs event-driven rule counts for bulk schedule dropdown
  const { scheduledCount, eventDrivenCount } = useMemo(() => {
    let scheduled = 0;
    let eventDriven = 0;
    for (const rule of rules) {
      if (isScheduledTrigger(rule.trigger)) {
        scheduled++;
      } else {
        eventDriven++;
      }
    }
    return { scheduledCount: scheduled, eventDrivenCount: eventDriven };
  }, [rules]);

  const handleBulkToggle = () => {
    bulkSetEnabled(!hasEnabledRules);
  };

  const handleBulkPauseScheduled = useCallback(() => {
    const result = bulkScheduleService.pauseAllScheduled(projectId);
    if (result.pausedCount > 0) {
      sonnerToast.success(`⏸️ Paused ${result.pausedCount} scheduled rules`, {
        action: {
          label: 'Undo',
          onClick: () => {
            bulkScheduleService.resumeAllScheduled(projectId);
          },
        },
      });
    }
  }, [projectId]);

  const handleBulkResumeScheduled = useCallback(() => {
    const result = bulkScheduleService.resumeAllScheduled(projectId);
    if (result.resumedCount > 0) {
      sonnerToast.success(`▶️ Resumed ${result.resumedCount} scheduled rules`, {
        action: {
          label: 'Undo',
          onClick: () => {
            bulkScheduleService.pauseAllScheduled(projectId);
          },
        },
      });
    }
  }, [projectId]);

  // Handlers
  const handleCreateNew = () => {
    setEditingRuleId(null);
    setIsRescheduling(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (ruleId: string) => {
    setEditingRuleId(ruleId);
    setIsRescheduling(false);
    setIsDialogOpen(true);
  };

  const handleReschedule = (ruleId: string) => {
    setEditingRuleId(ruleId);
    setIsRescheduling(true);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (ruleId: string) => {
    duplicateRule(ruleId);
  };

  const handleDuplicateToProject = (ruleId: string, targetProjectId: string) => {
    duplicateToProject(ruleId, targetProjectId, sections);
  };

  const handleDeleteClick = (ruleId: string) => {
    setRuleToDelete(ruleId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (ruleToDelete) {
      deleteRule(ruleToDelete);
      setRuleToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  const handleDeleteCancel = () => {
    setRuleToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleToggle = (ruleId: string) => {
    toggleRule(ruleId);
  };

  // Dry-run preview state
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);

  const handlePreview = useCallback((ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    const tasks = useDataStore.getState().tasks;
    const result = dryRunScheduledRule(
      rule,
      Date.now(),
      tasks,
      sections,
      (event, context) => evaluateRules(event, [rule], context),
    );
    setDryRunResult(result);
    setDryRunOpen(true);
  }, [rules, sections]);

  const handleRunNow = useCallback((ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    schedulerService.evaluateSingleRule(rule);
    onShowToast?.(`Rule "${rule.name}" executed manually.`, 'success');
  }, [rules, onShowToast]);

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingRuleId(null);
      setIsRescheduling(false);
    }
  };

  // Empty state: no rules
  if (rules.length === 0) {
    return (
      <>
        <EmptyState
          icon={Zap}
          title="Automate repetitive work"
          description="Create rules to move cards, set dates, and more when things change in your project."
          actionLabel="+ Create your first rule"
          onAction={handleCreateNew}
        />

        <RuleDialog
          open={isDialogOpen}
          onOpenChange={handleDialogClose}
          projectId={projectId}
          sections={sections}
          editingRule={editingRule}
        />
      </>
    );
  }

  // Rule list: one or more rules
  return (
    <div className="space-y-4">
      {/* Header with "+ New Rule" button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Automation Rules</h2>
          {rules.length >= MAX_RULES_WARNING_THRESHOLD && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              title="Consider reviewing and consolidating your rules"
            >
              <AlertTriangle className="h-3 w-3" />
              {rules.length} rules
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scheduledCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Schedule actions">
                  Schedule actions
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => bulkSetEnabled(false)}>
                  All rules ({rules.length}) — Disable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetEnabled(true)}>
                  All rules ({rules.length}) — Enable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkPauseScheduled}>
                  Scheduled only ({scheduledCount}) — Pause
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkResumeScheduled}>
                  Scheduled only ({scheduledCount}) — Resume
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetEnabled(false)}>
                  Event-driven only ({eventDrivenCount}) — Disable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetEnabled(true)}>
                  Event-driven only ({eventDrivenCount}) — Enable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            onClick={handleBulkToggle}
            variant="outline"
            size="sm"
          >
            {hasEnabledRules ? 'Disable all' : 'Enable all'}
          </Button>
          <Button
            onClick={handleCreateNew}
            size="sm"
            className="bg-accent-brand hover:bg-accent-brand/90 text-white"
          >
            + New Rule
          </Button>
        </div>
      </div>

      {/* Rule cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedRules.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sortedRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                sections={sections}
                projectId={projectId}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDuplicateToProject={handleDuplicateToProject}
                onDelete={handleDeleteClick}
                onToggle={handleToggle}
                onPreview={handlePreview}
                onRunNow={handleRunNow}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Rule Dialog */}
      <RuleDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        projectId={projectId}
        sections={sections}
        editingRule={editingRule}
      />

      {/* Dry Run Preview Dialog */}
      {dryRunResult && (
        <DryRunDialog
          open={dryRunOpen}
          onOpenChange={setDryRunOpen}
          result={dryRunResult}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
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
