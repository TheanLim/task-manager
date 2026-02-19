'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, GripVertical, MoreVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { RulePreview } from './RulePreview';
import { RuleCardExecutionLog } from './RuleCardExecutionLog';
import { ProjectPickerDialog } from './ProjectPickerDialog';
import { TRIGGER_META, ACTION_META, formatRelativeTime } from '../services/rulePreviewService';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

interface RuleCardProps {
  rule: AutomationRule;
  sections: Section[];
  projectId: string;
  onEdit: (ruleId: string) => void;
  onDuplicate: (ruleId: string) => void;
  onDuplicateToProject: (ruleId: string, targetProjectId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string) => void;
}

// Category color mapping for badges
const TRIGGER_CATEGORY_COLORS: Record<string, string> = {
  card_move: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  card_change: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  section_change: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const ACTION_CATEGORY_COLORS: Record<string, string> = {
  move: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  status: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  dates: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  create: 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300',
};

export function RuleCard({
  rule,
  sections,
  projectId,
  onEdit,
  onDuplicate,
  onDuplicateToProject,
  onDelete,
  onToggle,
}: RuleCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Get trigger and action metadata
  const triggerMeta = TRIGGER_META.find((t) => t.type === rule.trigger.type);
  const actionMeta = ACTION_META.find((a) => a.type === rule.action.type);

  // Check if rule is broken
  const isBroken = rule.brokenReason !== null;

  // Sortable drag-and-drop
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${!rule.enabled ? 'opacity-60' : ''} ${isDragging ? 'opacity-50 z-50' : ''}`}
      {...attributes}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Name, Toggle, Actions */}
          <div className="flex items-start justify-between gap-3">
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
              aria-label="Drag to reorder"
              tabIndex={-1}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{rule.name}</h3>
                {!rule.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Paused
                  </Badge>
                )}
                {isBroken && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This rule references a deleted section</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={rule.enabled}
                onCheckedChange={() => onToggle(rule.id)}
                aria-label={`Enable rule ${rule.name}`}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(rule.id)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Duplicate</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => onDuplicate(rule.id)}>
                        In this project
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPickerOpen(true)}>
                        To another project...
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onClick={() => onDelete(rule.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Natural language description */}
          <RulePreview
            trigger={{ type: rule.trigger.type, sectionId: rule.trigger.sectionId }}
            action={{
              type: rule.action.type,
              sectionId: rule.action.sectionId,
              dateOption: rule.action.dateOption,
              position: rule.action.position,
              cardTitle: rule.action.cardTitle,
              cardDateOption: rule.action.cardDateOption,
              specificMonth: rule.action.specificMonth,
              specificDay: rule.action.specificDay,
              monthTarget: rule.action.monthTarget,
            }}
            sections={sections}
            filters={rule.filters}
          />

          {/* Type badges with arrow */}
          <div className="flex items-center gap-2 text-xs">
            {triggerMeta && (
              <Badge
                variant="outline"
                className={TRIGGER_CATEGORY_COLORS[triggerMeta.category]}
              >
                {triggerMeta.label}
              </Badge>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            {actionMeta && (
              <Badge
                variant="outline"
                className={ACTION_CATEGORY_COLORS[actionMeta.category]}
              >
                {actionMeta.label}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="text-xs text-muted-foreground">
            Ran {rule.executionCount} {rule.executionCount === 1 ? 'time' : 'times'} · Last
            fired {rule.lastExecutedAt ? formatRelativeTime(rule.lastExecutedAt) : 'Never'}
          </div>

          {/* Execution log */}
          <RuleCardExecutionLog entries={rule.recentExecutions ?? []} />
        </div>
      </CardContent>

      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeProjectId={projectId}
        onSelect={(targetProjectId) => onDuplicateToProject(rule.id, targetProjectId)}
      />
    </Card>
  );
}
