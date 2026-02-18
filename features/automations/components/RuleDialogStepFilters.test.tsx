import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleDialogStepFilters } from './RuleDialogStepFilters';
import type { CardFilter } from '../schemas';
import type { Section } from '@/lib/schemas';

/**
 * Component Tests for RuleDialogStepFilters
 * 
 * Feature: automations-filters-dates
 * 
 * These tests verify the RuleDialogStepFilters component renders the filter
 * management UI and handles user interactions properly.
 * 
 * Validates Requirements: 9.3, 9.4, 9.5, 9.6, 9.7
 */

describe('RuleDialogStepFilters', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const mockOnFiltersChange = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders "+ Add filter" button', () => {
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    it('shows info message when no filters are added', () => {
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      expect(screen.getByText(/no filters added/i)).toBeInTheDocument();
      expect(screen.getByText(/the rule will apply to all cards/i)).toBeInTheDocument();
    });

    it('renders descriptive text about filters', () => {
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      expect(screen.getByText(/add optional filters to narrow down/i)).toBeInTheDocument();
    });
  });

  describe('Add Filter Dropdown', () => {
    it('shows dropdown menu when "+ Add filter" button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const addButton = screen.getByRole('button', { name: /add filter/i });
      await user.click(addButton);

      // Check for category labels
      expect(screen.getByText('Section')).toBeInTheDocument();
      expect(screen.getByText('Due Date Presence')).toBeInTheDocument();
      expect(screen.getByText('Due Date - Positive')).toBeInTheDocument();
      expect(screen.getByText('Due Date - Negative')).toBeInTheDocument();
      expect(screen.getByText('Due Date - Comparison')).toBeInTheDocument();
    });

    it('adds section filter when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const addButton = screen.getByRole('button', { name: /add filter/i });
      await user.click(addButton);

      const menuItem = screen.getByText('Card is in section');
      await user.click(menuItem);

      expect(mockOnFiltersChange).toHaveBeenCalledWith([
        {
          type: 'in_section',
          sectionId: 'section-1',
        },
      ]);
    });

    it('adds simple date filter when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const addButton = screen.getByRole('button', { name: /add filter/i });
      await user.click(addButton);

      const menuItem = screen.getByText('Card has a due date');
      await user.click(menuItem);

      expect(mockOnFiltersChange).toHaveBeenCalledWith([
        {
          type: 'has_due_date',
        },
      ]);
    });

    it('adds comparison filter with default values when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const addButton = screen.getByRole('button', { name: /add filter/i });
      await user.click(addButton);

      const menuItem = screen.getByText('Card due in less than...');
      await user.click(menuItem);

      expect(mockOnFiltersChange).toHaveBeenCalledWith([
        {
          type: 'due_in_less_than',
          value: 1,
          unit: 'days',
        },
      ]);
    });

    it('adds between filter with default values when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const addButton = screen.getByRole('button', { name: /add filter/i });
      await user.click(addButton);

      const menuItem = screen.getByText('Card due in between...');
      await user.click(menuItem);

      expect(mockOnFiltersChange).toHaveBeenCalledWith([
        {
          type: 'due_in_between',
          minValue: 1,
          maxValue: 7,
          unit: 'days',
        },
      ]);
    });
  });

  describe('Filter List Rendering', () => {
    it('renders FilterRow components for each filter', () => {
      const filters: CardFilter[] = [
        { type: 'has_due_date' },
        { type: 'in_section', sectionId: 'section-1' },
      ];

      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      // Check that both filters are rendered
      expect(screen.getByText('has a due date')).toBeInTheDocument();
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    it('does not show info message when filters are present', () => {
      const filters: CardFilter[] = [
        { type: 'has_due_date' },
      ];

      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      expect(screen.queryByText(/no filters added/i)).not.toBeInTheDocument();
    });
  });

  describe('Filter Modification', () => {
    it('calls onFiltersChange when a filter is modified', async () => {
      const user = userEvent.setup();
      const filters: CardFilter[] = [
        { type: 'due_in_less_than', value: 3, unit: 'days' },
      ];

      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      // Find the input and modify it
      const input = screen.getByDisplayValue('3') as HTMLInputElement;
      await user.type(input, '5');

      // Verify onFiltersChange was called
      expect(mockOnFiltersChange).toHaveBeenCalled();
    });
  });

  describe('Filter Removal', () => {
    it('calls onFiltersChange with updated array when X button is clicked', async () => {
      const user = userEvent.setup();
      const filters: CardFilter[] = [
        { type: 'has_due_date' },
        { type: 'is_overdue' },
      ];

      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      // Find all remove buttons (X buttons)
      const removeButtons = screen.getAllByRole('button', { name: '' });
      // Click the first remove button (excluding the Plus icon button)
      const xButton = removeButtons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-x'));
      
      if (xButton) {
        await user.click(xButton);
      }

      // Verify onFiltersChange was called with the remaining filter
      expect(mockOnFiltersChange).toHaveBeenCalledWith([
        { type: 'is_overdue' },
      ]);
    });

    it('removes all filters when last filter X button is clicked', async () => {
      const user = userEvent.setup();
      const filters: CardFilter[] = [
        { type: 'has_due_date' },
      ];

      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      // Find the remove button
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const xButton = removeButtons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-x'));
      
      if (xButton) {
        await user.click(xButton);
      }

      // Verify onFiltersChange was called with empty array
      expect(mockOnFiltersChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Skip Button', () => {
    it('calls onSkip when Skip button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <RuleDialogStepFilters
          filters={[]}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const skipButton = screen.getByRole('button', { name: /skip/i });
      await user.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('calls onSkip even when filters are present', async () => {
      const user = userEvent.setup();
      const filters: CardFilter[] = [
        { type: 'has_due_date' },
      ];
      
      render(
        <RuleDialogStepFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
          onSkip={mockOnSkip}
          sections={mockSections}
        />
      );

      const skipButton = screen.getByRole('button', { name: /skip/i });
      await user.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });
});
