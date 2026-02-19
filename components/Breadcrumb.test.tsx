import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

// Mock next/navigation
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock next/link — renders as a plain <a> tag in tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock data store
const mockGetProjectById = vi.fn();
vi.mock('@/stores/dataStore', () => ({
  useDataStore: (selector: (s: any) => any) =>
    selector({ getProjectById: mockGetProjectById }),
}));

// Mock useHydrated — returns true by default (jsdom useEffect fires synchronously)
let mockHydrated = true;
vi.mock('@/app/hooks/useHydrated', () => ({
  useHydrated: () => mockHydrated,
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetProjectById.mockReset();
    mockHydrated = true;
  });

  it('renders nothing before hydration to avoid SSR mismatch', () => {
    mockHydrated = false;
    mockGet.mockImplementation((key: string) => {
      if (key === 'project') return 'proj-1';
      return null;
    });
    mockGetProjectById.mockReturnValue({ id: 'proj-1', name: 'My Project' });

    const { container } = render(<Breadcrumb />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders nothing when no project or view is set', () => {
    mockGet.mockReturnValue(null);
    const { container } = render(<Breadcrumb />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders "All Tasks" for global tasks view', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'view') return 'tasks';
      return null;
    });

    render(<Breadcrumb />);
    expect(screen.getByText('All Tasks')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('renders project name when project is selected', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'project') return 'proj-1';
      return null;
    });
    mockGetProjectById.mockReturnValue({ id: 'proj-1', name: 'My Project' });

    render(<Breadcrumb />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders project name and tab when both are set', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'project') return 'proj-1';
      if (key === 'tab') return 'board';
      return null;
    });
    mockGetProjectById.mockReturnValue({ id: 'proj-1', name: 'My Project' });

    render(<Breadcrumb />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('shows "Unknown Project" when project is not found', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'project') return 'nonexistent';
      return null;
    });
    mockGetProjectById.mockReturnValue(undefined);

    render(<Breadcrumb />);
    expect(screen.getByText('Unknown Project')).toBeInTheDocument();
  });

  it('renders accessible breadcrumb nav element', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'view') return 'tasks';
      return null;
    });

    render(<Breadcrumb />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector('ol')).toBeInTheDocument();
  });
});
