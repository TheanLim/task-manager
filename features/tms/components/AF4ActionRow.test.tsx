/**
 * Tests for AF4ActionRow component.
 * Feature: tms-inline-interactions, Properties 3, 4, and 21
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AF4ActionRow } from './AF4ActionRow';
import type { Task } from '@/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    description: 'Buy groceries',
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
    ...overrides,
  };
}

function renderRow(task = makeTask(), handlers = {
  onMadeProgress: vi.fn(),
  onDone: vi.fn(),
  onSkip: vi.fn(),
  onFlag: vi.fn(),
}) {
  render(<AF4ActionRow task={task} {...handlers} />);
  return handlers;
}

describe('AF4ActionRow', () => {
  // ── Property 3: button variants ───────────────────────────────────────────

  it('renders four buttons', () => {
    renderRow();
    expect(screen.getByRole('button', { name: /made progress/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /flag/i })).toBeTruthy();
  });

  it('"Made Progress" button has bg-primary and flex-1 classes', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /made progress/i });
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('flex-1');
  });

  it('"Flag" button has amber text class', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /flag/i });
    expect(btn.className).toContain('text-amber-400');
  });

  // ── Property 4: dispatch correct actions ──────────────────────────────────

  it('clicking "Made Progress" calls onMadeProgress', () => {
    const handlers = { onMadeProgress: vi.fn(), onDone: vi.fn(), onSkip: vi.fn(), onFlag: vi.fn() };
    renderRow(makeTask(), handlers);
    fireEvent.click(screen.getByRole('button', { name: /made progress/i }));
    expect(handlers.onMadeProgress).toHaveBeenCalledOnce();
  });

  it('clicking "Done" calls onDone', () => {
    const handlers = { onMadeProgress: vi.fn(), onDone: vi.fn(), onSkip: vi.fn(), onFlag: vi.fn() };
    renderRow(makeTask(), handlers);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(handlers.onDone).toHaveBeenCalledOnce();
  });

  it('clicking "Skip" calls onSkip', () => {
    const handlers = { onMadeProgress: vi.fn(), onDone: vi.fn(), onSkip: vi.fn(), onFlag: vi.fn() };
    renderRow(makeTask(), handlers);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(handlers.onSkip).toHaveBeenCalledOnce();
  });

  it('clicking "Flag" calls onFlag', () => {
    const handlers = { onMadeProgress: vi.fn(), onDone: vi.fn(), onSkip: vi.fn(), onFlag: vi.fn() };
    renderRow(makeTask(), handlers);
    fireEvent.click(screen.getByRole('button', { name: /flag/i }));
    expect(handlers.onFlag).toHaveBeenCalledOnce();
  });

  // ── Property 21: aria-labels include task name ────────────────────────────

  it('each button aria-label includes the task description', () => {
    const task = makeTask({ description: 'Buy groceries' });
    renderRow(task);

    expect(screen.getByRole('button', { name: /made progress on: buy groceries/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /done: buy groceries/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /skip: buy groceries/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /flag: buy groceries/i })).toBeTruthy();
  });

  it('aria-labels update when task description changes', () => {
    const task = makeTask({ description: 'Write report' });
    renderRow(task);
    expect(screen.getByRole('button', { name: /made progress on: write report/i })).toBeTruthy();
  });

  // ── Req 1.9: border-t separator ───────────────────────────────────────────

  it('container has border-t class for visual anchoring', () => {
    const { container } = render(
      <AF4ActionRow task={makeTask()} onMadeProgress={vi.fn()} onDone={vi.fn()} onSkip={vi.fn()} onFlag={vi.fn()} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('border-t');
  });
});
