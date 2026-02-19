import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonProjectList } from './SkeletonProjectList';

describe('SkeletonProjectList', () => {
  it('renders 5 skeleton rows', () => {
    const { container } = render(<SkeletonProjectList />);
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    expect(rows).toHaveLength(5);
  });

  it('marks the container as busy for accessibility', () => {
    render(<SkeletonProjectList />);
    const container = screen.getByLabelText('Loading projects');
    expect(container).toHaveAttribute('aria-busy', 'true');
  });

  it('each row contains a dot, text bar, and count pill', () => {
    const { container } = render(<SkeletonProjectList />);
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    rows.forEach((row) => {
      // Color dot
      expect(row.querySelector('.rounded-full.w-2.h-2')).toBeInTheDocument();
      // Text bar
      expect(row.querySelector('.h-4.rounded')).toBeInTheDocument();
      // Count pill
      expect(row.querySelector('.ml-auto.h-5.w-8')).toBeInTheDocument();
    });
  });

  it('applies animate-pulse to skeleton elements', () => {
    const { container } = render(<SkeletonProjectList />);
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    // 3 pulsing elements per row × 5 rows = 15
    expect(pulsingElements.length).toBe(15);
  });
});
