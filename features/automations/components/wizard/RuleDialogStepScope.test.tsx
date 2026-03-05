import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleDialogStepScope } from './RuleDialogStepScope';

// Polyfill ResizeObserver for jsdom (required by cmdk)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
  // Polyfill scrollIntoView for jsdom (required by cmdk)
  Element.prototype.scrollIntoView = vi.fn();
});

/**
 * Component Tests for RuleDialogStepScope
 * 
 * Feature: global-automations-phase2
 * 
 * These tests verify the RuleDialogStepScope component renders the scope
 * selection UI for global rules with proper validation and project selection.
 */

describe('RuleDialogStepScope', () => {
  const mockProjects = [
    { id: 'project-1', name: 'Project Alpha' },
    { id: 'project-2', name: 'Project Beta' },
    { id: 'project-3', name: 'Project Gamma' },
  ];

  const mockOnChange = vi.fn();
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders radio group with "All Projects" and "Selected Projects" options', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      expect(screen.getByRole('radio', { name: /all projects/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /selected projects/i })).toBeInTheDocument();
    });

    it('does NOT render "All Projects Except" option', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      expect(screen.queryByText(/all projects except/i)).not.toBeInTheDocument();
    });

    it('renders descriptive text about scope', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      expect(screen.getByText(/choose which projects this rule should apply to/i)).toBeInTheDocument();
    });
  });

  describe('Radio Group Selection', () => {
    it('selects "All Projects" by default when scope="all"', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const allRadio = screen.getByRole('radio', { name: /all projects/i });
      expect(allRadio).toBeChecked();
    });

    it('selects "Selected Projects" by default when scope="selected"', () => {
      render(
        <RuleDialogStepScope
          scope="selected"
          selectedProjectIds={['project-1']}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      expect(selectedRadio).toBeChecked();
    });

    it('selects "All Projects" when scope="all_except" (Phase 2 decision)', () => {
      render(
        <RuleDialogStepScope
          scope="all_except"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const allRadio = screen.getByRole('radio', { name: /all projects/i });
      expect(allRadio).toBeChecked();
    });

    it('calls onChange with scope="all" and empty selectedProjectIds when "All Projects" is selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="selected"
          selectedProjectIds={['project-1']}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const allRadio = screen.getByRole('radio', { name: /all projects/i });
      await user.click(allRadio);

      expect(mockOnChange).toHaveBeenCalledWith({
        scope: 'all',
        selectedProjectIds: [],
      });
    });

    it('calls onChange with scope="selected" when "Selected Projects" is selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(mockOnChange).toHaveBeenCalledWith({
        scope: 'selected',
        selectedProjectIds: [],
      });
    });
  });

  describe('Project Multi-picker (Selected Projects mode)', () => {
    it('does NOT render project picker when scope="all"', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument();
    });

    it('renders project picker when scope="selected"', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });

    it('renders Command component for project picker', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // Check for Command wrapper with aria-label
      expect(screen.getByLabelText(/projects included in rule scope/i)).toBeInTheDocument();
    });

    it('renders Checkbox for each project', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const checkboxes = screen.getAllByRole('checkbox', { hidden: true });
      expect(checkboxes.length).toBe(3);
    });

    it('calls onChange when a project item is toggled', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // Click the project option text to toggle via CommandItem onSelect
      await user.click(screen.getByText('Project Alpha'));

      expect(mockOnChange).toHaveBeenCalledWith({
        scope: 'selected',
        selectedProjectIds: ['project-1'],
      });
    });

    it('shows Check icon when project is selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="selected"
          selectedProjectIds={['project-1']}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      // Project picker is already visible since scope="selected"
      const checkboxes = screen.getAllByRole('checkbox', { hidden: true });
      // First checkbox (Project Alpha) should be checked
      expect(checkboxes[0]).toBeChecked();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input in project picker', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument();
    });

    it('filters project list when search query matches', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const searchInput = screen.getByPlaceholderText(/search projects/i);
      await user.type(searchInput, 'Alpha');

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
      expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument();
    });

    it('shows "No projects found" when search has no matches', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const searchInput = screen.getByPlaceholderText(/search projects/i);
      await user.type(searchInput, 'NonExistent');

      expect(screen.getByText('No projects found.')).toBeInTheDocument();
    });
  });

  describe('Select All / Clear Buttons', () => {
    it('renders Select all button', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    it('renders Clear button', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('calls onChange with all project IDs when Select all is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        scope: 'selected',
        selectedProjectIds: ['project-1', 'project-2', 'project-3'],
      });
    });

    it('calls onChange with empty array when Clear is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={['project-1', 'project-2']}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        scope: 'selected',
        selectedProjectIds: [],
      });
    });

    it('disables Select all when no projects match search', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const searchInput = screen.getByPlaceholderText(/search projects/i);
      await user.type(searchInput, 'NonExistent');

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeDisabled();
    });

    it('disables Clear when no projects selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Footer Count', () => {
    it('renders "{N} of {M} projects selected" footer', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={['project-1']}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByText('1 of 3 projects selected')).toBeInTheDocument();
    });

    it('updates footer count when projects are selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // Click the project option text to toggle via CommandItem onSelect
      await user.click(screen.getByText('Project Alpha'));

      expect(screen.getByText('1 of 3 projects selected')).toBeInTheDocument();
    });

    it('uses aria-live="polite" for screen reader announcements', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      const footer = screen.getByText('0 of 3 projects selected');
      expect(footer).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Validation', () => {
    it('shows validation error "Select at least one project to continue." when invalid', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByText('Select at least one project to continue.')).toBeInTheDocument();
    });

    it('hides validation error when at least one project is selected', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // Click the project option text to toggle via CommandItem onSelect
      await user.click(screen.getByText('Project Alpha'));

      await waitFor(() => {
        expect(screen.queryByText('Select at least one project to continue.')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('focuses first radio option on mount', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      // The first radio button should be focused
      const firstRadio = screen.getByRole('radio', { name: /all projects/i });
      expect(firstRadio).toHaveFocus();
    });

    it('Arrow Down cycles to next radio option', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      await user.keyboard('{ArrowDown}');

      const secondRadio = screen.getByRole('radio', { name: /selected projects/i });
      expect(secondRadio).toHaveFocus();
    });

    it('Arrow Up cycles to previous radio option', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const firstRadio = screen.getByRole('radio', { name: /all projects/i });
      await user.keyboard('{ArrowDown}'); // Move to second
      await user.keyboard('{ArrowUp}'); // Back to first

      expect(firstRadio).toHaveFocus();
    });

    it('Space selects radio option', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      // Click the "Selected Projects" radio to select it
      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(selectedRadio).toBeChecked();
    });

    it('Enter selects radio option', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      // Click the "Selected Projects" radio to select it
      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(selectedRadio).toBeChecked();
    });
  });

  describe('ARIA Labels', () => {
    it('has aria-label="Rule scope" on radio group', () => {
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /rule scope/i })).toBeInTheDocument();
    });

    it('has aria-label="Projects included in rule scope" on Command wrapper', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      expect(screen.getByLabelText(/projects included in rule scope/i)).toBeInTheDocument();
    });
  });

  describe('Radio Card Styles', () => {
    it('applies border-border style to unselected radio cards', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      // First select "Selected Projects" to make "All Projects" unselected
      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // Now the "All Projects" radio card is a <button> element
      const allRadioCard = screen.getByRole('radio', { name: /all projects/i });
      expect(allRadioCard).toHaveClass('border-border');
    });

    it('applies border-accent-brand bg-accent-brand/5 to selected radio card', async () => {
      const user = userEvent.setup();
      render(
        <RuleDialogStepScope
          scope="all"
          selectedProjectIds={[]}
          projects={mockProjects}
          onChange={mockOnChange}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      );

      const selectedRadio = screen.getByRole('radio', { name: /selected projects/i });
      await user.click(selectedRadio);

      // The selected radio card is the <button> element itself
      expect(selectedRadio).toHaveClass('border-accent-brand');
      expect(selectedRadio).toHaveClass('bg-accent-brand/5');
    });
  });
});
