import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalRulesSection } from './GlobalRulesSection';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';

const NOW = '2026-01-01T00:00:00.000Z';

const projectSections: Section[] = [
  { id: 'sec-todo', projectId: 'proj-1', name: 'To Do', order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW },
];

function makeGlobalRule(id: string, name: string): AutomationRule {
  return {
    id,
    projectId: null,
    name,
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
  } as any;
}

describe('GlobalRulesSection', () => {
  it('renders nothing when globalRules is empty', () => {
    const { container } = render(
      <GlobalRulesSection
        globalRules={[]}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders N GlobalRuleCards when N global rules exist', () => {
    const rules = [
      makeGlobalRule('g1', 'Rule Alpha'),
      makeGlobalRule('g2', 'Rule Beta'),
      makeGlobalRule('g3', 'Rule Gamma'),
    ];
    render(
      <GlobalRulesSection
        globalRules={rules}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.getByText('Rule Alpha')).toBeInTheDocument();
    expect(screen.getByText('Rule Beta')).toBeInTheDocument();
    expect(screen.getByText('Rule Gamma')).toBeInTheDocument();
  });

  it('renders "(N active)" count in section header', () => {
    const rules = [makeGlobalRule('g1', 'Rule A'), makeGlobalRule('g2', 'Rule B')];
    render(
      <GlobalRulesSection
        globalRules={rules}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.getByText('(2 active)')).toBeInTheDocument();
  });

  it('"Manage" link calls onNavigateToGlobal', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <GlobalRulesSection
        globalRules={[makeGlobalRule('g1', 'Rule A')]}
        projectSections={projectSections}
        onNavigateToGlobal={onNavigate}
      />
    );
    await user.click(screen.getByText('Manage'));
    expect(onNavigate).toHaveBeenCalled();
  });

  it('has aria-label "Active global rules" on the section', () => {
    render(
      <GlobalRulesSection
        globalRules={[makeGlobalRule('g1', 'Rule A')]}
        projectSections={projectSections}
        onNavigateToGlobal={vi.fn()}
      />
    );
    expect(screen.getByRole('region', { name: 'Active global rules' })).toBeInTheDocument();
  });
});

// ── ISSUE-6: deep-link from rule name (TDD) ───────────────────────────────────

describe('GlobalRulesSection — deep-link from rule name', () => {
  it('clicking a rule name calls onNavigateToGlobal with that rule ID', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const rules = [makeGlobalRule('g1', 'Rule Alpha')];

    render(
      <GlobalRulesSection
        globalRules={rules}
        projectSections={projectSections}
        onNavigateToGlobal={onNavigate}
      />
    );

    // Rule name should be clickable
    await user.click(screen.getByText('Rule Alpha'));
    expect(onNavigate).toHaveBeenCalledWith('g1');
  });
});
