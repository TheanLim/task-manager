import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RulePreview } from './RulePreview';
import type { TriggerConfig, ActionConfig } from '../services/preview/rulePreviewService';
import type { Section } from '@/lib/schemas';

const mockSections: Section[] = [
  { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'section-2', projectId: 'project-1', name: 'Done', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

const completeTrigger: TriggerConfig = { type: 'card_marked_complete', sectionId: null };
const completeAction: ActionConfig = {
  type: 'mark_card_incomplete',
  sectionId: null,
  dateOption: null,
  position: null,
  cardTitle: null,
  cardDateOption: null,
  specificMonth: null,
  specificDay: null,
  monthTarget: null,
};

describe('RulePreview', () => {
  /**
   * Req 7.4 / 14.5: RulePreview uses aria-live="polite" and aria-atomic="true"
   * so screen readers announce preview changes.
   */
  it('renders with aria-live="polite" and aria-atomic="true" (Req 7.4, 14.5)', () => {
    const { container } = render(
      <RulePreview trigger={completeTrigger} action={completeAction} sections={mockSections} />
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders text parts as spans and value parts as badges (Req 7.1)', () => {
    const trigger: TriggerConfig = { type: 'card_moved_into_section', sectionId: 'section-1' };
    const { container } = render(
      <RulePreview trigger={trigger} action={completeAction} sections={mockSections} />
    );

    // Should contain Badge elements for dynamic values (section name)
    const badges = container.querySelectorAll('.bg-accent-brand\\/20');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows underscore placeholders for incomplete config (Req 7.2)', () => {
    const emptyTrigger: TriggerConfig = { type: null, sectionId: null };
    const { container } = render(
      <RulePreview trigger={emptyTrigger} action={completeAction} sections={mockSections} />
    );

    expect(container.textContent).toContain('___');
  });
});
