'use client';

import { AlertTriangle, ArrowRight, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { TRIGGER_META, ACTION_META } from '../services/rulePreviewService';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

interface RuleCardProps {
  rule: AutomationRule;
  sections: Section[];
  onEdit: (ruleId: string) => void;
  onDuplicate: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string) => void;
}

// Category color mapping for badges
const TRIGGER_CATEGORY_COLORS: Record<string, string> = {
  card_move: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  card_change: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const ACTION_CATEGORY_COLORS: Record<string, string> = {
  move: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  status: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  dates: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export function RuleCard({
  rule,
  sections,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
}: RuleCardProps) {
  // Get trigger and action metadata
  const triggerMeta = TRIGGER_META.find((t) => t.type === rule.trigger.type);
  const actionMeta = ACTION_META.find((a) => a.type === rule.action.type);

  // Format last executed time
  const formatLastExecuted = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const executed = new Date(timestamp);
    const diffMs = now.getTime() - executed.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return executed.toLocaleDateString();
  };

  // Check if rule is broken
  const isBroken = rule.brokenReason !== null;

  return (
    <Card className={`${!rule.enabled ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Name, Toggle, Actions */}
          <div className="flex items-start justify-between gap-3">
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
                  <DropdownMenuItem onClick={() => onDuplicate(rule.id)}>
                    Duplicate
                  </DropdownMenuItem>
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
            fired {formatLastExecuted(rule.lastExecutedAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
