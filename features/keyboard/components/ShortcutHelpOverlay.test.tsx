import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutHelpOverlay } from './ShortcutHelpOverlay';
import { useAppStore } from '@/stores/appStore';

// Mock the appStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('ShortcutHelpOverlay', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Return empty overrides — use defaults
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { keyboardShortcuts: Record<string, unknown> }) => unknown) =>
        selector({ keyboardShortcuts: {} }),
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ShortcutHelpOverlay open={false} onClose={mockOnClose} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders a dialog with correct ARIA attributes when open', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Keyboard shortcuts');
  });

  it('renders as a 400px wide panel', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[400px]');
  });

  it('groups shortcuts by category', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Task Actions')).toBeInTheDocument();
  });

  it('displays shortcut labels and key bindings', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    // Check a few representative shortcuts from each category
    expect(screen.getByText('New task')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Edit task')).toBeInTheDocument();
    expect(screen.getByText('Move up')).toBeInTheDocument();
  });

  it('renders key bindings in kbd elements', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    const kbdElements = screen.getAllByText((_, el) => el?.tagName === 'KBD');
    expect(kbdElements.length).toBeGreaterThan(0);
    // Check that kbd elements have the correct styling classes
    const firstKbd = kbdElements[0];
    expect(firstKbd.className).toContain('font-mono');
    expect(firstKbd.className).toContain('bg-muted');
  });

  it('reflects user-customized key bindings', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { keyboardShortcuts: Record<string, unknown> }) => unknown) =>
        selector({
          keyboardShortcuts: {
            'global.newTask': {
              key: 't',
              label: 'New task',
              category: 'Global',
              description: 'Create a new task',
            },
          },
        }),
    );

    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    // The customized key 't' should appear instead of default 'n'
    const kbdElements = screen.getAllByText('t', { selector: 'kbd' });
    expect(kbdElements.length).toBeGreaterThanOrEqual(1);
  });

  it('closes on Escape key', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes when close button is clicked', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('uses slide-in-right animation', () => {
    render(<ShortcutHelpOverlay open={true} onClose={mockOnClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('animate-slide-in-right');
  });
});
