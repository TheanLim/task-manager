import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalRuleCard } from './GlobalRuleCard';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

const NOW = '2026-01-01T00:00:00.000Z';

const projectSections: Section[] = [
  { id: 'sec-todo', projectId: 'proj-1', name: 'To Do', order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW },
  { id: 'sec-done', projectId: 'proj-1', name: 'Done', order: 1, collapsed: false, createdAt: NOW, updatedAt: NOW },
];

function makeGlobalRule(overrides?: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'global-1',
    projectId: null,
    name: 'Auto-complete globally',
    trigger: { type: 'card_marked_complete', sectionId: null },
    filters: [],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    excludedProjectIds: [],
    ...overrides,
  } as any;
}

describe('GlobalRuleCard', () => {
  it('renders rule name with GlobalRulesBadge', () => {
    render(
      <GlobalRuleCard
        rule={makeGlobalRule()}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.getByText('Auto-complete globally')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('renders trigger/action summary in muted text', () => {
    render(
      <GlobalRuleCard
        rule={makeGlobalRule()}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    // RulePreview renders a description
    expect(screen.getByText(/When a card/i)).toBeInTheDocument();
  });

  it('does NOT render inline skip warning when sections match', () => {
    const rule = makeGlobalRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-done' } as any,
    });
    render(
      <GlobalRuleCard
        rule={rule}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.queryByText(/section not found/)).not.toBeInTheDocument();
  });

  it('renders inline skip warning when trigger section is missing from project', () => {
    const rule = makeGlobalRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-other-project', sectionName: 'Backlog' } as any,
    });
    render(
      <GlobalRuleCard
        rule={rule}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.getByText(/section not found — rule skipped/)).toBeInTheDocument();
    // "Backlog" appears in both the preview and the warning — check warning specifically
    const warning = screen.getByText(/section not found — rule skipped/);
    expect(warning.textContent).toContain('Backlog');
  });

  it('calls onNavigateToGlobal with ruleId when skip warning link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const rule = makeGlobalRule({
      id: 'global-1',
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-missing', sectionName: 'Backlog' } as any,
    });
    render(
      <GlobalRuleCard
        rule={rule}
        projectSections={projectSections}
        onNavigateToGlobal={onNavigate}
      />
    );
    await user.click(screen.getByText(/section not found — rule skipped/));
    expect(onNavigate).toHaveBeenCalledWith('global-1');
  });
});
