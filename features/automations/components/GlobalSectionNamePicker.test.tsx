import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSectionNamePicker } from './GlobalSectionNamePicker';
import type { Section } from '@/lib/schemas';

const NOW = '2026-01-01T00:00:00.000Z';

function makeSection(id: string, name: string, projectId: string): Section {
  return { id, projectId, name, order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW };
}

const allSections: Section[] = [
  makeSection('s1', 'To Do', 'proj-1'),
  makeSection('s2', 'Done', 'proj-1'),
  makeSection('s3', 'Done', 'proj-2'),       // duplicate name — should deduplicate
  makeSection('s4', 'In Progress', 'proj-2'),
  makeSection('s5', 'Backlog', 'proj-3'),
];

describe('GlobalSectionNamePicker', () => {
  it('renders the trigger button with placeholder when no value', () => {
    render(
      <GlobalSectionNamePicker allSections={allSections} value={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Type or select a section name...')).toBeInTheDocument();
  });

  it('shows selected value in trigger button', () => {
    render(
      <GlobalSectionNamePicker allSections={allSections} value="Done" onChange={vi.fn()} />
    );
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('opens dropdown and shows deduplicated section names', async () => {
    const user = userEvent.setup();
    render(
      <GlobalSectionNamePicker allSections={allSections} value={null} onChange={vi.fn()} />
    );
    await user.click(screen.getByRole('combobox'));
    // Should show unique names only — "Done" appears once despite being in 2 projects
    const doneItems = screen.getAllByText('Done');
    // One in the button area (if selected) + one in the list — but value is null so just one in list
    expect(doneItems).toHaveLength(1);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('calls onChange with the selected name when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlobalSectionNamePicker allSections={allSections} value={null} onChange={onChange} />
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Backlog'));
    expect(onChange).toHaveBeenCalledWith('Backlog');
  });

  it('calls onChange with typed free-text value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GlobalSectionNamePicker allSections={allSections} value={null} onChange={onChange} />
    );
    await user.click(screen.getByRole('combobox'));
    const input = screen.getByPlaceholderText('Type a section name...');
    await user.type(input, 'Custom Section');
    expect(onChange).toHaveBeenLastCalledWith('Custom Section');
  });

  it('filters options as user types', async () => {
    const user = userEvent.setup();
    render(
      <GlobalSectionNamePicker allSections={allSections} value={null} onChange={vi.fn()} />
    );
    await user.click(screen.getByRole('combobox'));
    const input = screen.getByPlaceholderText('Type a section name...');
    await user.type(input, 'Do');
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
  });
});
