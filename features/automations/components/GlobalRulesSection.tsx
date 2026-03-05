'use client';

import { Globe } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GlobalRuleCard } from './GlobalRuleCard';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

interface GlobalRulesSectionProps {
  globalRules: AutomationRule[];
  /** Sections from the current project */
  projectSections: Section[];
  /** Project ID for toggle/promote operations */
  projectId: string;
  /** Called when user clicks "Manage" or a rule's skip warning link */
  onNavigateToGlobal: (ruleId?: string) => void;
  /** Called when user toggles a global rule for this project */
  onToggleForProject: (ruleId: string) => void;
  /** Called when user clicks "Promote to Global" on a local rule */
  onPromoteToGlobal: (ruleId: string) => void;
}

/**
 * Read-only section rendered above local rules in AutomationTab.
 * Hidden entirely when no global rules exist.
 */
export function GlobalRulesSection({
  globalRules,
  projectSections,
  projectId,
  onNavigateToGlobal,
  onToggleForProject,
  onPromoteToGlobal,
}: GlobalRulesSectionProps) {
  if (globalRules.length === 0) return null;

  return (
    <section aria-label="Active global rules" className="space-y-2">
      <Separator />

      {/* Section header */}
      <div className="flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Global Rules</span>
        <span className="text-sm text-muted-foreground">
          ({globalRules.length} active)
        </span>
        <button
          type="button"
          onClick={() => onNavigateToGlobal()}
          className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
        >
          Manage
        </button>
      </div>

      {/* Rule cards */}
      <div className="space-y-2">
        {globalRules.map((rule) => (
          <GlobalRuleCard
            key={rule.id}
            rule={rule}
            projectSections={projectSections}
            projectId={projectId}
            onNavigateToGlobal={onNavigateToGlobal}
            onToggleForProject={onToggleForProject}
            onPromoteToGlobal={onPromoteToGlobal}
          />
        ))}
      </div>

      <Separator />
    </section>
  );
}
