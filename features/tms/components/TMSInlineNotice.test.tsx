import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TMSInlineNotice } from './TMSInlineNotice';

describe('TMSInlineNotice', () => {
  // ── Variant roles and aria-live ──────────────────────────────────────────

  it('variant="info" renders role="status"', () => {
    render(<TMSInlineNotice variant="info" message="Info message" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('variant="info" has aria-live="polite"', () => {
    render(<TMSInlineNotice variant="info" message="Info message" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('variant="info" has info styling (blue tones)', () => {
    render(<TMSInlineNotice variant="info" message="Info message" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('blue');
  });

  it('variant="warning" renders role="alert"', () => {
    render(<TMSInlineNotice variant="warning" message="Warning message" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('variant="warning" has aria-live="assertive"', () => {
    render(<TMSInlineNotice variant="warning" message="Warning message" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('variant="warning" has warning styling (amber tones)', () => {
    render(<TMSInlineNotice variant="warning" message="Warning message" />);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('amber');
  });

  it('variant="success" renders role="status"', () => {
    render(<TMSInlineNotice variant="success" message="Success message" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('variant="success" has aria-live="polite"', () => {
    render(<TMSInlineNotice variant="success" message="Success message" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('variant="success" has success styling (green tones)', () => {
    render(<TMSInlineNotice variant="success" message="Success message" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('green');
  });

  // ── Message rendering ────────────────────────────────────────────────────

  it('renders the message text', () => {
    render(<TMSInlineNotice variant="info" message="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  // ── autoDismiss ──────────────────────────────────────────────────────────

  describe('autoDismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onDismiss after autoDismiss ms', () => {
      const onDismiss = vi.fn();
      render(
        <TMSInlineNotice variant="info" message="msg" autoDismiss={4000} onDismiss={onDismiss} />,
      );
      expect(onDismiss).not.toHaveBeenCalled();
      vi.advanceTimersByTime(4000);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not call onDismiss before autoDismiss ms', () => {
      const onDismiss = vi.fn();
      render(
        <TMSInlineNotice variant="info" message="msg" autoDismiss={4000} onDismiss={onDismiss} />,
      );
      vi.advanceTimersByTime(3999);
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('prefers-reduced-motion: component still renders and onDismiss fires after autoDismiss', () => {
      // motion-safe CSS is suppressed by the browser, but the timer still fires
      const onDismiss = vi.fn();
      render(
        <TMSInlineNotice variant="warning" message="msg" autoDismiss={2000} onDismiss={onDismiss} />,
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      vi.advanceTimersByTime(2000);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // ── Dismiss button ───────────────────────────────────────────────────────

  it('dismiss × button calls onDismiss immediately when clicked', () => {
    const onDismiss = vi.fn();
    render(<TMSInlineNotice variant="info" message="msg" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismiss button is not rendered when onDismiss is not provided', () => {
    render(<TMSInlineNotice variant="info" message="msg" />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  it('renders action buttons with correct labels', () => {
    const actions = [
      { label: 'Clear filters', onClick: vi.fn(), variant: 'secondary' as const },
      { label: 'End session', onClick: vi.fn(), variant: 'ghost-destructive' as const },
    ];
    render(<TMSInlineNotice variant="warning" message="msg" actions={actions} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument();
  });

  it('action button onClick fires when clicked', () => {
    const onClick = vi.fn();
    const actions = [{ label: 'Do it', onClick, variant: 'secondary' as const }];
    render(<TMSInlineNotice variant="info" message="msg" actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('secondary action has amber border/text styling', () => {
    const actions = [{ label: 'Secondary', onClick: vi.fn(), variant: 'secondary' as const }];
    render(<TMSInlineNotice variant="warning" message="msg" actions={actions} />);
    const btn = screen.getByRole('button', { name: 'Secondary' });
    expect(btn.className).toContain('amber');
  });

  it('ghost-destructive action has zinc border/text styling', () => {
    const actions = [{ label: 'Destructive', onClick: vi.fn(), variant: 'ghost-destructive' as const }];
    render(<TMSInlineNotice variant="warning" message="msg" actions={actions} />);
    const btn = screen.getByRole('button', { name: 'Destructive' });
    expect(btn.className).toContain('zinc');
  });

  // ── Animation ────────────────────────────────────────────────────────────

  it('animation container has motion-safe:animate-in class', () => {
    render(<TMSInlineNotice variant="info" message="msg" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('motion-safe:animate-in');
  });
});
