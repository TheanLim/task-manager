'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, AlertTriangle, ChevronDown } from 'lucide-react';
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
import { useRuleActions } from '../hooks/useRuleActions';
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
  const ruleActions = useRuleActions(rules, sections, projectId, onShowToast);

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

  useEffect(() => {
    if (wasDialogOpen.current && !isDialogOpen) {
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

  // Get the rule being edited
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

  const hasEnabledRules = rules.some((r) => r.enabled);
  const handleBulkToggle = () => bulkSetEnabled(!hasEnabledRules);

  // Handlers
  const handleCreateNew = () => { setEditingRuleId(null); setIsRescheduling(false); setIsDialogOpen(true); };
  const handleEdit = (ruleId: string) => { setEditingRuleId(ruleId); setIsRescheduling(false); setIsDialogOpen(true); };
  const handleReschedule = (ruleId: string) => { setEditingRuleId(ruleId); setIsRescheduling(true); setIsDialogOpen(true); };
  const handleDuplicate = (ruleId: string) => duplicateRule(ruleId);
  const handleDuplicateToProject = (ruleId: string, targetProjectId: string) => duplicateToProject(ruleId, targetProjectId, sections);
  const handleDeleteClick = (ruleId: string) => { setRuleToDelete(ruleId); setDeleteConfirmOpen(true); };
  const handleDeleteConfirm = () => { if (ruleToDelete) { deleteRule(ruleToDelete); setRuleToDelete(null); } setDeleteConfirmOpen(false); };
  const handleDeleteCancel = () => { setRuleToDelete(null); setDeleteConfirmOpen(false); };
  const handleToggle = (ruleId: string) => toggleRule(ruleId);
  const handleDialogClose = (open: boolean) => { setIsDialogOpen(open); if (!open) { setEditingRuleId(null); setIsRescheduling(false); } };

  // Empty state
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
        <RuleDialog open={isDialogOpen} onOpenChange={handleDialogClose} projectId={projectId} sections={sections} editingRule={editingRule} />
      </>
    );
  }

  // Rule list
  return (
    <div className="space-y-4">
      {/* Header */}
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
          {ruleActions.scheduledCount > 0 && (
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
                <DropdownMenuItem onClick={ruleActions.handleBulkPauseScheduled}>
                  Scheduled only ({ruleActions.scheduledCount}) — Pause
                </DropdownMenuItem>
                <DropdownMenuItem onClick={ruleActions.handleBulkResumeScheduled}>
                  Scheduled only ({ruleActions.scheduledCount}) — Resume
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetEnabled(false)}>
                  Event-driven only ({ruleActions.eventDrivenCount}) — Disable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetEnabled(true)}>
                  Event-driven only ({ruleActions.eventDrivenCount}) — Enable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={handleBulkToggle} variant="outline" size="sm">
            {hasEnabledRules ? 'Disable all' : 'Enable all'}
          </Button>
          <Button onClick={handleCreateNew} size="sm" className="bg-accent-brand hover:bg-accent-brand/90 text-white">
            + New Rule
          </Button>
        </div>
      </div>

      {/* Rule cards */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedRules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
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
                onPreview={ruleActions.handlePreview}
                onRunNow={ruleActions.handleRunNow}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Rule Dialog */}
      <RuleDialog open={isDialogOpen} onOpenChange={handleDialogClose} projectId={projectId} sections={sections} editingRule={editingRule} />

      {/* Dry Run Preview Dialog */}
      {ruleActions.dryRunResult && (
        <DryRunDialog open={ruleActions.dryRunOpen} onOpenChange={ruleActions.setDryRunOpen} result={ruleActions.dryRunResult} />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
