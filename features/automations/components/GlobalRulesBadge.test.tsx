import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalRulesBadge } from './GlobalRulesBadge';

describe('GlobalRulesBadge', () => {
  it('renders Globe icon and "Global" text', () => {
    render(<GlobalRulesBadge />);
    expect(screen.getByText('Global')).toBeInTheDocument();
    // Globe icon is aria-hidden, check via SVG class
    const { container } = render(<GlobalRulesBadge />);
    expect(container.querySelector('.lucide-globe')).toBeInTheDocument();
  });

  it('has aria-label "Global rule — applies to all projects"', () => {
    render(<GlobalRulesBadge />);
    // Badge has aria-label directly on the element
    const badge = screen.getByText('Global').closest('[aria-label]');
    expect(badge).toHaveAttribute('aria-label', 'Global rule — applies to all projects');
  });
});
