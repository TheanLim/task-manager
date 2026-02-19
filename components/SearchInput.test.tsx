import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the search input with placeholder', () => {
    render(<SearchInput />);
    expect(screen.getByPlaceholderText('Search tasks… (upcoming)')).toBeInTheDocument();
  });

  it('renders the ⌘K keyboard shortcut badge', () => {
    render(<SearchInput />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<SearchInput />);
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toBeInTheDocument();
  });

  it('calls onSearch callback when typing', () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search tasks… (upcoming)');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('focuses input on Cmd+K', () => {
    render(<SearchInput />);
    const input = screen.getByPlaceholderText('Search tasks… (upcoming)');

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('focuses input on Ctrl+K', () => {
    render(<SearchInput />);
    const input = screen.getByPlaceholderText('Search tasks… (upcoming)');

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('does not focus on plain K keypress', () => {
    render(<SearchInput />);
    const input = screen.getByPlaceholderText('Search tasks… (upcoming)');

    fireEvent.keyDown(document, { key: 'k' });
    expect(document.activeElement).not.toBe(input);
  });

  it('works without onSearch callback', () => {
    render(<SearchInput />);
    const input = screen.getByPlaceholderText('Search tasks… (upcoming)');
    // Should not throw
    fireEvent.change(input, { target: { value: 'test' } });
  });
});
