import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromoteConfirmDialog } from './PromoteConfirmDialog';

describe('PromoteConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    ruleName: 'Auto-close stale',
    projectName: 'Sprint Board',
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText('What should happen to the original rule?')
    ).toBeInTheDocument();
  });

  it('shows source rule name and project name in description', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText(
        '"Auto-close stale" in "Sprint Board" was promoted. The original project rule still exists.'
      )
    ).toBeInTheDocument();
  });

  it('renders two radio options', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Keep the original rule')).toBeInTheDocument();
    expect(screen.getByText('Delete the original rule')).toBeInTheDocument();
  });

  it('"Keep" is selected by default', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('"Keep" description includes project name', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText(
        'Both rules will run in "Sprint Board". You can delete it manually later.'
      )
    ).toBeInTheDocument();
  });

  it('"Delete" description text', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText('Only the new global rule will run.')
    ).toBeInTheDocument();
  });

  it('Confirm button calls onConfirm with "keep" by default', async () => {
    const user = userEvent.setup();
    render(<PromoteConfirmDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('keep');
  });

  it('clicking "Delete" option then Confirm calls onConfirm with "delete"', async () => {
    const user = userEvent.setup();
    render(<PromoteConfirmDialog {...defaultProps} />);

    await user.click(screen.getByText('Delete the original rule'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('delete');
  });

  it('radio group has correct role and aria-label', () => {
    render(<PromoteConfirmDialog {...defaultProps} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-label', 'Original rule disposition');
  });

  it('does not render content when closed', () => {
    render(<PromoteConfirmDialog {...defaultProps} open={false} />);
    expect(
      screen.queryByText('What should happen to the original rule?')
    ).not.toBeInTheDocument();
  });
});
