'use client';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalTasksHeader } from './GlobalTasksHeader';

// Mock useAppStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    globalTasksDisplayMode: 'nested',
    setGlobalTasksDisplayMode: vi.fn(),
    needsAttentionSort: false,
    setNeedsAttentionSort: vi.fn(),
    autoHideThreshold: 'show-all',
    setAutoHideThreshold: vi.fn(),
    showRecentlyCompleted: false,
    setShowRecentlyCompleted: vi.fn(),
  }),
}));

// Mock useMediaQuery
vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

describe('GlobalTasksHeader', () => {
  it('renders the Add Task button', () => {
    const onAddTask = vi.fn();
    render(<GlobalTasksHeader onAddTask={onAddTask} />);
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('Add Task button has yellow accent-brand styling', () => {
    const onAddTask = vi.fn();
    render(<GlobalTasksHeader onAddTask={onAddTask} />);
    const btn = screen.getByRole('button', { name: /add task/i });
    expect(btn.className).toMatch(/bg-accent-brand/);
  });

  it('calls onAddTask when Add Task button is clicked', () => {
    const onAddTask = vi.fn();
    render(<GlobalTasksHeader onAddTask={onAddTask} />);
    fireEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });
});
