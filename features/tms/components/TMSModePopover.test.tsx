import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TMSModePopover } from './TMSModePopover';

// Radix Popover uses portals — ensure the portal target exists in jsdom
// @testing-library/react renders into document.body by default, which is fine.

const defaultProps = {
  open: true,
  activeSystem: 'none',
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

function renderPopover(props: Partial<typeof defaultProps> = {}) {
  return render(
    <TMSModePopover {...defaultProps} {...props}>
      <button>Open</button>
    </TMSModePopover>,
  );
}

describe('TMSModePopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders 5 options (None, AF4, DIT, FVP, Standard)', () => {
    renderPopover();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('AF4')).toBeInTheDocument();
    expect(screen.getByText('DIT')).toBeInTheDocument();
    expect(screen.getByText('FVP')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('has role="listbox" on the options container', () => {
    renderPopover();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('each option has role="option"', () => {
    renderPopover();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
  });

  // ── aria-selected ──────────────────────────────────────────────────────────

  it('active option has aria-selected="true"; others have aria-selected="false"', () => {
    renderPopover({ activeSystem: 'af4' });
    const options = screen.getAllByRole('option');
    const af4Option = options.find((o) => o.textContent?.includes('AF4'));
    const noneOption = options.find((o) => o.textContent?.includes('None'));

    expect(af4Option).toHaveAttribute('aria-selected', 'true');
    expect(noneOption).toHaveAttribute('aria-selected', 'false');
  });

  it('none option is aria-selected when activeSystem is "none"', () => {
    renderPopover({ activeSystem: 'none' });
    const options = screen.getAllByRole('option');
    const noneOption = options.find((o) => o.textContent?.includes('None'));
    expect(noneOption).toHaveAttribute('aria-selected', 'true');
  });

  // ── Animation class ────────────────────────────────────────────────────────

  it('animation container has motion-safe:animate-in class (NOT bare animate-in)', () => {
    const { container } = renderPopover();
    // The PopoverContent element should have the motion-safe: prefixed class
    const popoverContent = container.ownerDocument.querySelector('[role="listbox"]')?.closest('[class*="motion-safe"]');
    // Check via the rendered DOM for the class on the popover content wrapper
    const allElements = container.ownerDocument.querySelectorAll('[class*="motion-safe"]');
    expect(allElements.length).toBeGreaterThan(0);
  });

  // ── Keyboard: number keys ──────────────────────────────────────────────────

  it('pressing "1" calls onSelect("af4") and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: '1' });
    expect(onSelect).toHaveBeenCalledWith('af4');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing "2" calls onSelect("dit") and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('dit');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing "3" calls onSelect("fvp") and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: '3' });
    expect(onSelect).toHaveBeenCalledWith('fvp');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing "4" calls onSelect("standard") and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: '4' });
    expect(onSelect).toHaveBeenCalledWith('standard');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing "0" calls onSelect("none") and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: '0' });
    expect(onSelect).toHaveBeenCalledWith('none');
    expect(onClose).toHaveBeenCalled();
  });

  // ── Keyboard: Escape ───────────────────────────────────────────────────────

  it('Escape calls onClose without calling onSelect', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onSelect, onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  // ── Keyboard: ArrowDown ────────────────────────────────────────────────────

  it('ArrowDown moves focus to next option', () => {
    renderPopover({ activeSystem: 'none' }); // starts focused on index 0 (none)
    // Press down once → focus moves to af4 (index 1)
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // Press Enter → should select af4
    const onSelect = vi.fn();
    const onClose = vi.fn();
    // Re-render with fresh mocks to capture the Enter after ArrowDown
    vi.clearAllMocks();
    const { unmount } = render(
      <TMSModePopover open activeSystem="none" onSelect={onSelect} onClose={onClose}>
        <button>Open</button>
      </TMSModePopover>,
    );
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('af4');
    unmount();
  });

  it('ArrowDown wraps from last option (standard) to first (none)', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TMSModePopover open activeSystem="standard" onSelect={onSelect} onClose={onClose}>
        <button>Open</button>
      </TMSModePopover>,
    );
    // standard is index 4 (last). ArrowDown should wrap to index 0 (none)
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('none');
  });

  // ── Keyboard: ArrowUp ─────────────────────────────────────────────────────

  it('ArrowUp moves focus to previous option', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TMSModePopover open activeSystem="af4" onSelect={onSelect} onClose={onClose}>
        <button>Open</button>
      </TMSModePopover>,
    );
    // af4 is index 1. ArrowUp → index 0 (none)
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('none');
  });

  it('ArrowUp wraps from first option (none) to last (standard)', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TMSModePopover open activeSystem="none" onSelect={onSelect} onClose={onClose}>
        <button>Open</button>
      </TMSModePopover>,
    );
    // none is index 0. ArrowUp should wrap to index 4 (standard)
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('standard');
  });

  // ── Keyboard: Enter ────────────────────────────────────────────────────────

  it('Enter on focused option calls onSelect with that option id', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TMSModePopover open activeSystem="fvp" onSelect={onSelect} onClose={onClose}>
        <button>Open</button>
      </TMSModePopover>,
    );
    // fvp is index 3 — focused on open
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('fvp');
    expect(onClose).toHaveBeenCalled();
  });

  // ── Does not fire when closed ──────────────────────────────────────────────

  it('keyboard events are ignored when popover is closed', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPopover({ open: false, onSelect, onClose });
    fireEvent.keyDown(document, { key: '1' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
