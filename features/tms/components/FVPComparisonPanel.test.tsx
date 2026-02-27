/**
 * Tests for FVPComparisonPanel component.
 * Feature: tms-inline-interactions, Properties 9, 10, and 21
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FVPComparisonPanel } from './FVPComparisonPanel';
import type { Task } from '@/types';

function makeTask(id: string, description: string): Task {
  return {
    id,
    description,
    completed: false,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    priority: 'none' as const,
    notes: '',
    assignee: '',
    tags: [],
    dueDate: null,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastActionAt: null,
  };
}

describe('FVPComparisonPanel', () => {
  const candidate = makeTask('c1', 'Write report');
  const reference = makeTask('r1', 'Buy groceries');

  // ── Property 9: question text contains both task names ────────────────────

  it('renders the candidate name in the question', () => {
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />);
    expect(screen.getByText('Write report')).toBeTruthy();
  });

  it('renders the reference task name in the question', () => {
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />);
    expect(screen.getByText('Buy groceries')).toBeTruthy();
  });

  it('both names have font-medium class', () => {
    const { container } = render(
      <FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />
    );
    const mediumSpans = container.querySelectorAll('.font-medium');
    expect(mediumSpans.length).toBeGreaterThanOrEqual(2);
  });

  // ── Property 10: buttons dispatch correct actions ─────────────────────────

  it('clicking "Yes, prioritise this" calls onYes', () => {
    const onYes = vi.fn();
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={onYes} onNo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /yes, prioritise/i }));
    expect(onYes).toHaveBeenCalledOnce();
  });

  it('clicking "No, skip it" calls onNo', () => {
    const onNo = vi.fn();
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={onNo} />);
    fireEvent.click(screen.getByRole('button', { name: /no, skip/i }));
    expect(onNo).toHaveBeenCalledOnce();
  });

  // ── Req 3.3: equal-width buttons ─────────────────────────────────────────

  it('both buttons have flex-1 class', () => {
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />);
    const yesBtn = screen.getByRole('button', { name: /yes, prioritise/i });
    const noBtn = screen.getByRole('button', { name: /no, skip/i });
    expect(yesBtn.className).toContain('flex-1');
    expect(noBtn.className).toContain('flex-1');
  });

  // ── Req 9.5 / 9.6: ARIA attributes ───────────────────────────────────────

  it('container has role="region"', () => {
    render(<FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />);
    expect(screen.getByRole('region', { name: /fvp comparison/i })).toBeTruthy();
  });

  it('container has aria-live="polite"', () => {
    const { container } = render(
      <FVPComparisonPanel candidate={candidate} referenceTask={reference} onYes={vi.fn()} onNo={vi.fn()} />
    );
    const region = container.querySelector('[role="region"]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });
});
