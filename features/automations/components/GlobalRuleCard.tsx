'use client';

import { Globe } from 'lucide-react';
import { GlobalRulesBadge } from './GlobalRulesBadge';
import { SectionMismatchWarning } from './SectionMismatchWarning';
import { RulePreview } from './RulePreview';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

interface GlobalRuleCardProps {
  rule: AutomationRule;
  /** Sections from the current project — used to detect section mismatches */
  projectSections: Section[];
  /** Called when the user clicks the "Manage" link or the skip warning link */
  onNavigateToGlobal: (ruleId: string) => void;
}

/**
 * Read-only condensed card for displaying a global rule inside a project's
 * AutomationTab. No edit/delete actions — lighter visual weight than RuleCard.
 */
export function GlobalRuleCard({ rule, projectSections, onNavigateToGlobal }: GlobalRuleCardProps) {
  // Detect section mismatch: trigger or action references a section not in this project
  const triggerSectionId = (rule.trigger as any).sectionId as string | null | undefined;
  const actionSectionId = rule.action.sectionId;

  const allProjectSectionIds = new Set(projectSections.map((s) => s.id));

  const missingTriggerSection =
    triggerSectionId && !allProjectSectionIds.has(triggerSectionId)
      ? (rule.trigger as any).sectionName ?? triggerSectionId
      : null;

  const missingActionSection =
    actionSectionId && !allProjectSectionIds.has(actionSectionId)
      ? rule.action.sectionName ?? actionSectionId
      : null;

  const missingSectionName = missingTriggerSection ?? missingActionSection;

  return (
    <div className="bg-muted/40 border border-border/50 rounded-md px-3 py-2 space-y-1.5">
      {/* Rule name + badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">{rule.name}</span>
        <GlobalRulesBadge />
      </div>

      {/* Trigger/action summary */}
      <div className="text-xs text-muted-foreground">
        <RulePreview
          trigger={{ type: rule.trigger.type, sectionId: (rule.trigger as any).sectionId }}
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
          sections={projectSections}
          filters={rule.filters}
        />
      </div>

      {/* Section mismatch inline warning */}
      {missingSectionName && (
        <SectionMismatchWarning
          skippedCount={1}
          sectionName={missingSectionName}
          inline
          onViewLog={() => onNavigateToGlobal(rule.id)}
        />
      )}
    </div>
  );
}
