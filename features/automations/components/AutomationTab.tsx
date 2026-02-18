'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { RuleDialog } from './RuleDialog';
import { useAutomationRules } from '../hooks/useAutomationRules';
import type { Section } from '@/lib/schemas';

interface AutomationTabProps {
  projectId: string;
  sections: Section[];
}

/**
 * AutomationTab component displays the automation rules for a project.
 * Shows an empty state when no rules exist, or a list of rule cards with CRUD operations.
 *
 * Validates Requirements: 2.1, 2.2, 2.3, 9.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export function AutomationTab({ projectId, sections }: AutomationTabProps) {
  const { rules, duplicateRule, deleteRule, toggleRule } = useAutomationRules(projectId);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Get the rule being edited
  const editingRule = editingRuleId ? rules.find((r) => r.id === editingRuleId) : null;

  // Handlers
  const handleCreateNew = () => {
    setEditingRuleId(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (ruleId: string) => {
    setEditingRuleId(ruleId);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (ruleId: string) => {
    duplicateRule(ruleId);
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

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingRuleId(null);
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
        <h2 className="text-lg font-semibold">Automation Rules</h2>
        <Button
          onClick={handleCreateNew}
          size="sm"
          className="bg-accent-brand hover:bg-accent-brand/90 text-white"
        >
          + New Rule
        </Button>
      </div>

      {/* Rule cards */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            sections={sections}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteClick}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Rule Dialog */}
      <RuleDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        projectId={projectId}
        sections={sections}
        editingRule={editingRule}
      />

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
