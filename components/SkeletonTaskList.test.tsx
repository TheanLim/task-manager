import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonTaskList } from './SkeletonTaskList';

describe('SkeletonTaskList', () => {
  it('renders 8 skeleton rows', () => {
    const { container } = render(<SkeletonTaskList />);
    // Each row is a direct child flex div of the container
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    expect(rows).toHaveLength(8);
  });

  it('marks the container as busy for accessibility', () => {
    render(<SkeletonTaskList />);
    const container = screen.getByLabelText('Loading tasks');
    expect(container).toHaveAttribute('aria-busy', 'true');
  });

  it('each row contains a checkbox shape and text bar', () => {
    const { container } = render(<SkeletonTaskList />);
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    rows.forEach((row) => {
      // Checkbox shape
      expect(row.querySelector('.w-4.h-4')).toBeInTheDocument();
      // Text bar
      expect(row.querySelector('.h-4.rounded')).toBeInTheDocument();
    });
  });

  it('applies animate-pulse to skeleton elements', () => {
    const { container } = render(<SkeletonTaskList />);
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    // At minimum: checkbox + text + badge per row
    expect(pulsingElements.length).toBeGreaterThanOrEqual(8);
  });

  it('some rows have extra badge elements', () => {
    const { container } = render(<SkeletonTaskList />);
    // Rows at index 0, 3, 6 (i % 3 === 0) get an extra badge
    const badges = container.querySelectorAll('.w-16.rounded-full');
    expect(badges).toHaveLength(3);
  });
});
