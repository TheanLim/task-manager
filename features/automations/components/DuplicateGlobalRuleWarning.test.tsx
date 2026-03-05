import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DuplicateGlobalRuleWarning } from './DuplicateGlobalRuleWarning';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  existingRuleName: 'Auto-archive completed',
  existingRuleId: 'rule-123',
  onViewExisting: vi.fn(),
  onPromoteAnyway: vi.fn(),
};

function renderWarning(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <DuplicateGlobalRuleWarning {...defaultProps} {...overrides} />
  );
}

describe('DuplicateGlobalRuleWarning', () => {
  it('renders dialog with title "Similar global rule exists"', () => {
    renderWarning();
    expect(screen.getByText('Similar global rule exists')).toBeInTheDocument();
  });

  it('shows existing rule name in description', () => {
    renderWarning();
    expect(
      screen.getByText(/Auto-archive completed.+already does the same thing/)
    ).toBeInTheDocument();
  });

  it('renders Cancel, View existing rule, and Promote anyway buttons', () => {
    renderWarning();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View existing rule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promote anyway' })).toBeInTheDocument();
  });

  it('calls onViewExisting with existingRuleId when "View existing rule" is clicked', async () => {
    const onViewExisting = vi.fn();
    renderWarning({ onViewExisting });

    await userEvent.click(screen.getByRole('button', { name: 'View existing rule' }));
    expect(onViewExisting).toHaveBeenCalledWith('rule-123');
  });

  it('calls onPromoteAnyway when "Promote anyway" is clicked', async () => {
    const onPromoteAnyway = vi.fn();
    renderWarning({ onPromoteAnyway });

    await userEvent.click(screen.getByRole('button', { name: 'Promote anyway' }));
    expect(onPromoteAnyway).toHaveBeenCalled();
  });
});
