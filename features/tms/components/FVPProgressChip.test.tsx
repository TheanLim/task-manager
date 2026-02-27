import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FVPProgressChip } from './FVPProgressChip';

describe('FVPProgressChip', () => {
  it('renders "FVP — 7 of 23" for progress=7, total=23', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    expect(screen.getByText(/FVP — 7 of 23/)).toBeInTheDocument();
  });

  it('has aria-live="polite" and aria-atomic="true"', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    const chip = document.querySelector('[aria-live="polite"]');
    expect(chip).not.toBeNull();
    expect(chip).toHaveAttribute('aria-atomic', 'true');
  });

  it('aria-label contains "7 of 23"', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    const chip = document.querySelector('[aria-label]');
    expect(chip?.getAttribute('aria-label')).toContain('7 of 23');
  });

  it('renders "(filtered)" suffix when isFiltered=true', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={true} />);
    expect(screen.getByText('(filtered)')).toBeInTheDocument();
  });

  it('does not render "(filtered)" when isFiltered=false', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    expect(screen.queryByText('(filtered)')).not.toBeInTheDocument();
  });

  it('has hidden md:inline-flex classes', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    const chip = document.querySelector('[aria-live="polite"]');
    expect(chip?.className).toContain('hidden');
    expect(chip?.className).toContain('md:inline-flex');
  });

  it('has min-w-[96px]', () => {
    render(<FVPProgressChip progress={7} total={23} isFiltered={false} />);
    const chip = document.querySelector('[aria-live="polite"]');
    expect(chip?.className).toContain('min-w-[96px]');
  });
});
