import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Flag mock ─────────────────────────────────────────────────────────────────
// We need to control ENABLE_TMS_NUDGE_BANNER per test.
// Use vi.mock with a factory that reads from a mutable object.

let mockFlagEnabled = true;

vi.mock('../flags', () => ({
  get ENABLE_TMS_NUDGE_BANNER() {
    return mockFlagEnabled;
  },
  ENABLE_FOCUS_TAB: false,
}));

// Import AFTER mock is set up
import { NudgeBanner } from './NudgeBanner';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NudgeBanner', () => {
  beforeEach(() => {
    mockFlagEnabled = true;
    localStorage.clear();
  });

  it('renders when ENABLE_TMS_NUDGE_BANNER=true and key is absent', () => {
    render(<NudgeBanner />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('does not render when ENABLE_TMS_NUDGE_BANNER=false', () => {
    mockFlagEnabled = false;
    render(<NudgeBanner />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('does not render when tms-nudge-dismissed key is present in localStorage', () => {
    localStorage.setItem('tms-nudge-dismissed', 'true');
    render(<NudgeBanner />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('dismiss button writes tms-nudge-dismissed=true to localStorage', () => {
    render(<NudgeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }));
    expect(localStorage.getItem('tms-nudge-dismissed')).toBe('true');
  });

  it('banner hides after dismiss button is clicked', () => {
    render(<NudgeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }));
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('CTA link text is "Take me there →"', () => {
    render(<NudgeBanner />);
    expect(screen.getByRole('link', { name: 'Take me there →' })).toBeInTheDocument();
  });

  it('dismiss button has aria-label="Dismiss this notice"', () => {
    render(<NudgeBanner />);
    expect(screen.getByRole('button', { name: 'Dismiss this notice' })).toBeInTheDocument();
  });
});
