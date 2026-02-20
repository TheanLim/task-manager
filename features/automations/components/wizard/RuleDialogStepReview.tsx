'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, X } from 'lucide-react';
import { TRIGGER_META, ACTION_META } from '../../services/preview/ruleMetadata';
import { formatFilterDescription } from '../../services/preview/formatters';
import { describeSchedule } from '../../services/preview/scheduleDescriptions';
import {
  buildPreviewParts,
  buildPreviewString,
  isDuplicateRule,
  type TriggerConfig,
  type ActionConfig,
} from '../../services/preview/rulePreviewService';
import type { Section } from '@/lib/schemas';
import type { AutomationRule, CardFilter } from '../../types';

interface RuleDialogStepReviewProps {
  trigger: TriggerConfig;
  action: ActionConfig;
  filters: CardFilter[];
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  onFiltersChange: (filters: CardFilter[]) => void;
  sections: Section[];
  onNavigateToStep: (step: 0 | 1 | 2 | 3) => void;
  onSave: () => void;
  isSaveDisabled: boolean;
  existingRules?: AutomationRule[];
  editingRuleId?: string;
}

export function RuleDialogStepReview({
  trigger,
  action,
  filters,
  ruleName,
  onRuleNameChange,
  onFiltersChange,
  sections,
  onNavigateToStep,
  onSave,
  isSaveDisabled,
  existingRules,
  editingRuleId,
}: RuleDialogStepReviewProps) {
  // Build section lookup
  const sectionLookup = (id: string) => sections.find((s) => s.id === id)?.name;

  // Check for duplicate rule
  const showDuplicateWarning = existingRules
    ? isDuplicateRule(trigger, action, existingRules, editingRuleId)
    : false;

  // Handle filter removal
  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onFiltersChange(newFilters);
  };

  // Get trigger metadata and category color
  const triggerMeta = trigger.type
    ? TRIGGER_META.find((t) => t.type === trigger.type)
    : null;
  const triggerCategoryColor =
    triggerMeta?.category === 'card_move'
      ? 'border-l-blue-500'
      : triggerMeta?.category === 'scheduled'
        ? 'border-l-amber-500'
        : triggerMeta?.category === 'section_change'
          ? 'border-l-violet-500'
          : 'border-l-emerald-500';

  const isScheduledTrigger = triggerMeta?.category === 'scheduled';
  const isOneTimeTrigger = trigger.type === 'scheduled_one_time';

  // Get action metadata and category color
  const actionMeta = action.type ? ACTION_META.find((a) => a.type === action.type) : null;
  const actionCategoryColor =
    actionMeta?.category === 'move'
      ? 'border-l-sky-500'
      : actionMeta?.category === 'status'
        ? 'border-l-emerald-500'
        : 'border-l-amber-500';

  // Build trigger description
  let triggerDescription: string;
  if (isScheduledTrigger && trigger.schedule) {
    triggerDescription = describeSchedule({ type: trigger.type!, schedule: trigger.schedule });
  } else if (triggerMeta) {
    triggerDescription = triggerMeta.needsSection
      ? trigger.sectionId
        ? `${triggerMeta.label} ${sectionLookup(trigger.sectionId) || '___'}`
        : `${triggerMeta.label} ___`
      : triggerMeta.label;
  } else {
    triggerDescription = '___';
  }

  // Build action description
  let actionDescription = '___';
  if (actionMeta) {
    if (
      actionMeta.type === 'move_card_to_top_of_section' ||
      actionMeta.type === 'move_card_to_bottom_of_section'
    ) {
      const position = action.position || 'top';
      const sectionName = action.sectionId ? sectionLookup(action.sectionId) || '___' : '___';
      actionDescription = `move to ${position} of ${sectionName}`;
    } else if (actionMeta.type === 'set_due_date') {
      const dateLabel = action.dateOption
        ? action.dateOption === 'next_working_day'
          ? 'next working day'
          : action.dateOption
        : '___';
      actionDescription = `set due date to ${dateLabel}`;
    } else {
      actionDescription = actionMeta.label;
    }
  }

  // Auto-populate rule name from preview if blank
  const displayRuleName =
    ruleName ||
    buildPreviewString(buildPreviewParts(trigger, action, sectionLookup));

  return (
    <div className="space-y-6">
      {/* Flow Diagram */}
      <div className="space-y-3">
        {/* WHEN Block */}
        <Card
          className={`border-l-4 ${triggerCategoryColor} cursor-pointer transition-colors hover:bg-accent/50`}
          onClick={() => onNavigateToStep(0)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOneTimeTrigger ? 'ON' : isScheduledTrigger ? 'EVERY' : 'WHEN'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm">
              {isOneTimeTrigger ? (
                <span className="font-medium">{triggerDescription}</span>
              ) : isScheduledTrigger ? (
                <>Every <span className="font-medium">{triggerDescription}</span></>
              ) : (
                <>When a {triggerMeta?.category === 'section_change' ? 'section' : 'card'} is <span className="font-medium">{triggerDescription}</span></>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* IF Block - Only show when filters are configured */}
        {filters.length > 0 && (
          <>
            <Card
              className="border-l-4 border-l-purple-500 cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => onNavigateToStep(1)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  IF
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <span>{formatFilterDescription(filter, sectionLookup)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFilter(index);
                        }}
                        className="ml-1 rounded-sm hover:bg-accent/50 p-0.5"
                        aria-label="Remove filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </>
        )}

        {/* THEN Block */}
        <Card
          className={`border-l-4 ${actionCategoryColor} cursor-pointer transition-colors hover:bg-accent/50`}
          onClick={() => onNavigateToStep(2)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              THEN
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm">
              <span className="font-medium capitalize">{actionDescription}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rule Name Input */}
      <div className="space-y-2">
        <Label htmlFor="rule-name">Rule name (optional)</Label>
        <Input
          id="rule-name"
          type="text"
          placeholder={displayRuleName}
          value={ruleName}
          onChange={(e) => onRuleNameChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use the auto-generated name
        </p>
      </div>

      {/* Duplicate rule warning */}
      {showDuplicateWarning && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          ⚠️ A similar rule already exists.
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={onSave}
        disabled={isSaveDisabled}
        className="w-full bg-accent-brand hover:bg-accent-brand/90 text-white"
      >
        Save Rule
      </Button>
    </div>
  );
}
