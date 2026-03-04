import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionMismatchWarning } from './SectionMismatchWarning';

describe('SectionMismatchWarning', () => {
  it('renders skippedCount and sectionName in message', () => {
    render(<SectionMismatchWarning skippedCount={3} sectionName="Done" />);
    expect(screen.getByText(/Skipped in 3 projects/)).toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
    expect(screen.getByText(/section not found/)).toBeInTheDocument();
  });

  it('renders singular "project" when skippedCount is 1', () => {
    render(<SectionMismatchWarning skippedCount={1} sectionName="Done" />);
    expect(screen.getByText(/Skipped in 1 project —/)).toBeInTheDocument();
  });

  it('renders "View in execution log →" link when onViewLog provided', () => {
    render(<SectionMismatchWarning skippedCount={2} sectionName="Done" onViewLog={vi.fn()} />);
    expect(screen.getByText('View in execution log →')).toBeInTheDocument();
  });

  it('calls onViewLog when link is clicked', async () => {
    const user = userEvent.setup();
    const onViewLog = vi.fn();
    render(<SectionMismatchWarning skippedCount={2} sectionName="Done" onViewLog={onViewLog} />);
    await user.click(screen.getByText('View in execution log →'));
    expect(onViewLog).toHaveBeenCalledOnce();
  });

  it('has role="alert" for screen reader announcement', () => {
    render(<SectionMismatchWarning skippedCount={1} sectionName="Done" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('inline variant renders simplified warning without link', () => {
    render(<SectionMismatchWarning skippedCount={1} sectionName="Done" inline />);
    expect(screen.getByText(/section not found — rule skipped/)).toBeInTheDocument();
    expect(screen.queryByText('View in execution log →')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
