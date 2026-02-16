import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutSettings } from './ShortcutSettings';
import { useAppStore } from '@/stores/appStore';

// Mock the appStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('ShortcutSettings', () => {
  const mockSetKeyboardShortcut = vi.fn();
  const mockResetKeyboardShortcuts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
          keyboardShortcuts: {},
          setKeyboardShortcut: mockSetKeyboardShortcut,
          resetKeyboardShortcuts: mockResetKeyboardShortcuts,
        }),
    );
  });

  it('renders all three category groups', () => {
    render(<ShortcutSettings />);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Task Actions')).toBeInTheDocument();
  });

  it('displays shortcut labels and key bindings', () => {
    render(<ShortcutSettings />);
    expect(screen.getByText('New task')).toBeInTheDocument();
    expect(screen.getByText('Edit task')).toBeInTheDocument();
  });

  it('enters recording mode when a kbd element is clicked', () => {
    render(<ShortcutSettings />);
    // Find the kbd for "New task" (key: 'n')
    const nKbd = screen.getAllByRole('button').find(
      (el) => el.tagName === 'KBD' && el.textContent === 'n',
    );
    expect(nKbd).toBeDefined();
    fireEvent.click(nKbd!);
    expect(screen.getByText('Press a key…')).toBeInTheDocument();
  });

  it('captures a key press and calls setKeyboardShortcut', () => {
    render(<ShortcutSettings />);
    const nKbd = screen.getAllByRole('button').find(
      (el) => el.tagName === 'KBD' && el.textContent === 'n',
    );
    fireEvent.click(nKbd!);
    // Now press 't' to reassign
    fireEvent.keyDown(document, { key: 't' });
    expect(mockSetKeyboardShortcut).toHaveBeenCalledWith('global.newTask', 't');
  });

  it('calls resetKeyboardShortcuts when reset button is clicked', () => {
    render(<ShortcutSettings />);
    const resetButton = screen.getByText('Reset to defaults');
    fireEvent.click(resetButton);
    expect(mockResetKeyboardShortcuts).toHaveBeenCalledTimes(1);
  });

  it('shows conflict badge when two actions share the same key', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
          keyboardShortcuts: {
            // Assign 'n' to search too — conflicts with newTask default
            'global.search': {
              key: 'n',
              label: 'Search',
              category: 'Global',
              description: 'Focus the search input',
            },
          },
          setKeyboardShortcut: mockSetKeyboardShortcut,
          resetKeyboardShortcuts: mockResetKeyboardShortcuts,
        }),
    );

    render(<ShortcutSettings />);
    const conflictBadges = screen.getAllByText('conflict');
    expect(conflictBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className', () => {
    const { container } = render(<ShortcutSettings className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
