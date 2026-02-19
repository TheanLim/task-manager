import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectPickerDialog } from './ProjectPickerDialog';
import { useDataStore } from '@/stores/dataStore';

vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn(),
}));

const mockProjects = [
  { id: 'proj-1', name: 'Project Alpha', description: '', viewMode: 'list' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'proj-2', name: 'Project Beta', description: '', viewMode: 'list' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'proj-3', name: 'Project Gamma', description: '', viewMode: 'board' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

describe('ProjectPickerDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    excludeProjectId: 'proj-1',
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDataStore as any).mockReturnValue({ projects: mockProjects });
  });

  it('renders dialog with title', () => {
    render(<ProjectPickerDialog {...defaultProps} />);
    expect(screen.getByText('Select a project')).toBeInTheDocument();
  });

  it('lists all projects except the excluded one', () => {
    render(<ProjectPickerDialog {...defaultProps} />);
    expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('Project Gamma')).toBeInTheDocument();
  });

  it('calls onSelect and closes dialog on project click', async () => {
    const user = userEvent.setup();
    render(<ProjectPickerDialog {...defaultProps} />);

    await user.click(screen.getByText('Project Beta'));

    expect(defaultProps.onSelect).toHaveBeenCalledWith('proj-2');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows empty state when no other projects exist', () => {
    (useDataStore as any).mockReturnValue({
      projects: [mockProjects[0]], // only the excluded project
    });
    render(<ProjectPickerDialog {...defaultProps} />);

    expect(screen.getByText('No other projects available')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<ProjectPickerDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Select a project')).not.toBeInTheDocument();
  });
});
