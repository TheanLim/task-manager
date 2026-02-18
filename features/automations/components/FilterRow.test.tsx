import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterRow } from './FilterRow';
import type { CardFilter } from '../types';
import type { Section } from '@/lib/schemas';

/**
 * Component Tests for FilterRow
 * 
 * Feature: automations-filters-dates
 * 
 * These tests verify the FilterRow component renders correct controls for each
 * filter type and handles user interactions properly.
 */

describe('FilterRow', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const mockOnChange = vi.fn();
  const mockOnRemove = vi.fn();

  describe('Section Filters', () => {
    it('renders section filter with in/not in selector and section picker', () => {
      const filter: CardFilter = {
        type: 'in_section',
        sectionId: 'section-1',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Card is')).toBeInTheDocument();
      expect(screen.getByText('section')).toBeInTheDocument();
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    it('renders not_in_section filter correctly', () => {
      const filter: CardFilter = {
        type: 'not_in_section',
        sectionId: 'section-2',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Card is')).toBeInTheDocument();
      expect(screen.getByText('section')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  describe('Simple Date Filters', () => {
    it('renders simple date filter with dropdown', () => {
      const filter: CardFilter = {
        type: 'has_due_date',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Card')).toBeInTheDocument();
      expect(screen.getByText('has a due date')).toBeInTheDocument();
    });

    it('renders different simple date filter types correctly', () => {
      const filters: CardFilter[] = [
        { type: 'no_due_date' },
        { type: 'is_overdue' },
        { type: 'due_today' },
        { type: 'not_due_tomorrow' },
      ];

      filters.forEach((filter) => {
        const { unmount } = render(
          <FilterRow
            filter={filter}
            sections={mockSections}
            onChange={mockOnChange}
            onRemove={mockOnRemove}
          />
        );
        expect(screen.getByText('Card')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Comparison Filters', () => {
    it('renders comparison filter with comparator, value input, and unit selector', () => {
      const filter: CardFilter = {
        type: 'due_in_less_than',
        value: 3,
        unit: 'days',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Card due in')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByText('less than')).toBeInTheDocument();
      expect(screen.getByText('days')).toBeInTheDocument();
    });

    it('calls onChange when comparison value changes', async () => {
      const user = userEvent.setup();
      const filter: CardFilter = {
        type: 'due_in_less_than',
        value: 3,
        unit: 'days',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      const input = screen.getByDisplayValue('3') as HTMLInputElement;
      
      // Simulate typing a digit - this will trigger onChange
      await user.type(input, '5');

      // Verify onChange was called (value will be 35 due to append behavior)
      expect(mockOnChange).toHaveBeenCalled();
      const calls = mockOnChange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Verify the structure is correct (type, value, unit present)
      expect(calls[calls.length - 1][0]).toHaveProperty('type', 'due_in_less_than');
      expect(calls[calls.length - 1][0]).toHaveProperty('unit', 'days');
      expect(calls[calls.length - 1][0]).toHaveProperty('value');
    });

    it('renders different comparison types correctly', () => {
      const filters: CardFilter[] = [
        { type: 'due_in_more_than', value: 5, unit: 'working_days' },
        { type: 'due_in_exactly', value: 7, unit: 'days' },
      ];

      filters.forEach((filter) => {
        const { unmount } = render(
          <FilterRow
            filter={filter}
            sections={mockSections}
            onChange={mockOnChange}
            onRemove={mockOnRemove}
          />
        );
        expect(screen.getByText('Card due in')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Between Filter', () => {
    it('renders between filter with two value inputs and unit selector', () => {
      const filter: CardFilter = {
        type: 'due_in_between',
        minValue: 3,
        maxValue: 7,
        unit: 'days',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Card due in between')).toBeInTheDocument();
      expect(screen.getByText('and')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('7')).toBeInTheDocument();
      expect(screen.getByText('days')).toBeInTheDocument();
    });

    it('calls onChange when minValue changes', async () => {
      const user = userEvent.setup();
      const filter: CardFilter = {
        type: 'due_in_between',
        minValue: 3,
        maxValue: 7,
        unit: 'days',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      const minInput = screen.getByDisplayValue('3') as HTMLInputElement;
      
      // Simulate typing a digit - this will trigger onChange
      await user.type(minInput, '5');

      // Verify onChange was called
      expect(mockOnChange).toHaveBeenCalled();
      const calls = mockOnChange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Verify the structure is correct
      expect(calls[calls.length - 1][0]).toHaveProperty('type', 'due_in_between');
      expect(calls[calls.length - 1][0]).toHaveProperty('minValue');
      expect(calls[calls.length - 1][0]).toHaveProperty('maxValue', 7);
      expect(calls[calls.length - 1][0]).toHaveProperty('unit', 'days');
    });

    it('calls onChange when maxValue changes', async () => {
      const user = userEvent.setup();
      const filter: CardFilter = {
        type: 'due_in_between',
        minValue: 3,
        maxValue: 7,
        unit: 'days',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      const maxInput = screen.getByDisplayValue('7') as HTMLInputElement;
      
      // Simulate typing a digit - this will trigger onChange
      await user.type(maxInput, '9');

      // Verify onChange was called
      expect(mockOnChange).toHaveBeenCalled();
      const calls = mockOnChange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Verify the structure is correct
      expect(calls[calls.length - 1][0]).toHaveProperty('type', 'due_in_between');
      expect(calls[calls.length - 1][0]).toHaveProperty('minValue', 3);
      expect(calls[calls.length - 1][0]).toHaveProperty('maxValue');
      expect(calls[calls.length - 1][0]).toHaveProperty('unit', 'days');
    });
  });

  describe('Remove Button', () => {
    it('calls onRemove when X button is clicked', async () => {
      const user = userEvent.setup();
      const filter: CardFilter = {
        type: 'has_due_date',
      };

      render(
        <FilterRow
          filter={filter}
          sections={mockSections}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: '' }); // X button has no text
      await user.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalled();
    });
  });
});
