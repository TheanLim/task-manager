import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleCardExecutionLog } from './RuleCardExecutionLog';
import type { ExecutionLogEntry } from '../types';

describe('RuleCardExecutionLog', () => {
  const sampleEntries: ExecutionLogEntry[] = [
    {
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      triggerDescription: "Card moved into 'Done'",
      actionDescription: 'Marked as complete',
      taskName: 'Fix login bug',
    },
    {
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      triggerDescription: "Card moved into 'In Progress'",
      actionDescription: 'Set due date',
      taskName: 'Update docs',
    },
  ];

  it('renders "Recent activity" header', () => {
    render(<RuleCardExecutionLog entries={[]} />);
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });

  it('content is hidden by default (collapsed)', () => {
    render(<RuleCardExecutionLog entries={sampleEntries} />);
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('shows "No activity yet" when entries is empty after expanding', async () => {
    const user = userEvent.setup();
    render(<RuleCardExecutionLog entries={[]} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows entry details after expanding', async () => {
    const user = userEvent.setup();
    render(<RuleCardExecutionLog entries={sampleEntries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    expect(screen.getByText(/Fix login bug/)).toBeInTheDocument();
    expect(screen.getByText(/Update docs/)).toBeInTheDocument();
    expect(screen.getByText(/Marked as complete/)).toBeInTheDocument();
    expect(screen.getByText(/Set due date/)).toBeInTheDocument();
  });

  it('collapses content on second click', async () => {
    const user = userEvent.setup();
    render(<RuleCardExecutionLog entries={sampleEntries} />);

    const toggle = screen.getByRole('button', { name: /recent activity/i });

    await user.click(toggle);
    expect(screen.getByText(/Fix login bug/)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(/Fix login bug/)).not.toBeInTheDocument();
  });

  it('sets aria-expanded correctly', async () => {
    const user = userEvent.setup();
    render(<RuleCardExecutionLog entries={[]} />);

    const toggle = screen.getByRole('button', { name: /recent activity/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
