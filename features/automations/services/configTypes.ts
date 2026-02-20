/**
 * Shared configuration types for automation rule wizard state.
 *
 * These types describe the shape of trigger and action configuration
 * as managed by the wizard UI. They're consumed by:
 * - useWizardState (hook state)
 * - RuleDialog + wizard step components (UI)
 * - ruleSaveService (entity construction)
 * - rulePreviewService (preview generation)
 *
 * Extracted from rulePreviewService.ts because they're not preview-specific —
 * they describe wizard/rule configuration state used across 3 layers.
 */

import type { TriggerType, ActionType, RelativeDateOption } from '../types';

export interface TriggerConfig {
  type: TriggerType | null;
  sectionId: string | null;
  schedule?: Record<string, unknown>;
  lastEvaluatedAt?: string | null;
  catchUpPolicy?: 'catch_up_latest' | 'skip_missed';
}

export interface ActionConfig {
  type: ActionType | null;
  sectionId: string | null;
  dateOption: RelativeDateOption | null;
  position: 'top' | 'bottom' | null;
  cardTitle: string | null;
  cardDateOption: RelativeDateOption | null;
  specificMonth: number | null;
  specificDay: number | null;
  monthTarget: 'this_month' | 'next_month' | null;
}
