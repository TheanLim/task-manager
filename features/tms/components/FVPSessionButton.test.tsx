/**
 * Tests for FVPSessionButton component.
 * Feature: tms-inline-interactions, Property 11
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FVPSessionButton } from './FVPSessionButton';

describe('FVPSessionButton', () => {
  it('shows "Begin FVP session" when hasDottedTasks is false', () => {
    render(<FVPSessionButton hasDottedTasks={false} onBegin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /begin fvp session/i })).toBeTruthy();
  });

  it('shows "Continue FVP session" when hasDottedTasks is true', () => {
    render(<FVPSessionButton hasDottedTasks={true} onBegin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /continue fvp session/i })).toBeTruthy();
  });

  it('calls onBegin when clicked', () => {
    const onBegin = vi.fn();
    render(<FVPSessionButton hasDottedTasks={false} onBegin={onBegin} />);
    fireEvent.click(screen.getByRole('button', { name: /begin fvp session/i }));
    expect(onBegin).toHaveBeenCalledOnce();
  });

  it('has border-t separator', () => {
    const { container } = render(<FVPSessionButton hasDottedTasks={false} onBegin={vi.fn()} />);
    expect((container.firstChild as HTMLElement).className).toContain('border-t');
  });
});
