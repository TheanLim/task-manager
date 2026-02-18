'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import {
  TRIGGER_META,
  ACTION_META,
  buildPreviewParts,
  buildPreviewString,
  type TriggerConfig,
  type ActionConfig,
} from '../services/rulePreviewService';
import type { Section } from '@/lib/schemas';

interface RuleDialogStepReviewProps {
  trigger: TriggerConfig;
  action: ActionConfig;
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  sections: Section[];
  onNavigateToStep: (step: 0 | 1 | 2) => void;
  onSave: () => void;
  isSaveDisabled: boolean;
}

export function RuleDialogStepReview({
  trigger,
  action,
  ruleName,
  onRuleNameChange,
  sections,
  onNavigateToStep,
  onSave,
  isSaveDisabled,
}: RuleDialogStepReviewProps) {
  // Build section lookup
  const sectionLookup = (id: string) => sections.find((s) => s.id === id)?.name;

  // Get trigger metadata and category color
  const triggerMeta = trigger.type
    ? TRIGGER_META.find((t) => t.type === trigger.type)
    : null;
  const triggerCategoryColor =
    triggerMeta?.category === 'card_move' ? 'border-l-blue-500' : 'border-l-emerald-500';

  // Get action metadata and category color
  const actionMeta = action.type ? ACTION_META.find((a) => a.type === action.type) : null;
  const actionCategoryColor =
    actionMeta?.category === 'move'
      ? 'border-l-sky-500'
      : actionMeta?.category === 'status'
        ? 'border-l-emerald-500'
        : 'border-l-amber-500';

  // Build trigger description
  const triggerDescription = triggerMeta
    ? triggerMeta.needsSection
      ? trigger.sectionId
        ? `${triggerMeta.label} ${sectionLookup(trigger.sectionId) || '___'}`
        : `${triggerMeta.label} ___`
      : triggerMeta.label
    : '___';

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
              WHEN
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm">
              When a card is <span className="font-medium">{triggerDescription}</span>
            </p>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* THEN Block */}
        <Card
          className={`border-l-4 ${actionCategoryColor} cursor-pointer transition-colors hover:bg-accent/50`}
          onClick={() => onNavigateToStep(1)}
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
