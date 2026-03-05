import { render, screen, fireEvent } from '@testing-library/react';
import { SectionResolutionStep } from './SectionResolutionStep';

describe('SectionResolutionStep', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders trigger section radio group when triggerSection is provided', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Trigger section: "Inbox"')).toBeInTheDocument();
    expect(screen.getAllByText('Match by name')[0]).toBeInTheDocument();
    expect(screen.getByText("Find a section named 'Inbox' in each project at run time. Recommended.")).toBeInTheDocument();
    expect(screen.getAllByText('This project only')[0]).toBeInTheDocument();
    expect(screen.getAllByText("Scope the rule to just 'Test Project'. The section ID will always resolve correctly.")[0]).toBeInTheDocument();
  });

  it('renders action section radio group when actionSection is provided', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Action section: "Done"')).toBeInTheDocument();
    expect(screen.getAllByText('Match by name')[1]).toBeInTheDocument();
    expect(screen.getByText("Find a section named 'Done' in each project at run time. Recommended.")).toBeInTheDocument();
    expect(screen.getAllByText('This project only')[1]).toBeInTheDocument();
    expect(screen.getAllByText("Scope the rule to just 'Test Project'. The section ID will always resolve correctly.")[1]).toBeInTheDocument();
  });

  it('calls onChange when trigger section option is selected', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    const actionOption = screen.getAllByText('This project only')[1];
    fireEvent.click(actionOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      triggerResolution: 'by_name',
      actionResolution: 'source_project_only',
    });
  });

  it('calls onChange when action section option is selected', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    const triggerOption = screen.getAllByText('This project only')[0];
    fireEvent.click(triggerOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      triggerResolution: 'source_project_only',
      actionResolution: 'by_name',
    });
  });

  it('renders info note at bottom', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Projects without a matching section will skip this rule and log a 'section not found' entry\./i)).toBeInTheDocument();
  });

  it('does not render trigger section when triggerSection is null', () => {
    render(
      <SectionResolutionStep
        triggerSection={null}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByText('Trigger section:')).not.toBeInTheDocument();
    expect(screen.getByText('Action section: "Done"')).toBeInTheDocument();
  });

  it('does not render action section when actionSection is null', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={null}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Trigger section: "Inbox"')).toBeInTheDocument();
    expect(screen.queryByText('Action section:')).not.toBeInTheDocument();
  });

  it('uses shadcn RadioGroup for each section', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    // There should be 2 RadioGroup elements (one for trigger, one for action)
    const radioGroups = screen.getAllByRole('radiogroup');
    expect(radioGroups).toHaveLength(2);
  });

  it('has correct info box classes', () => {
    render(
      <SectionResolutionStep
        triggerSection={{ id: 't1', name: 'Inbox' }}
        actionSection={{ id: 'a1', name: 'Done' }}
        sourceProjectName='Test Project'
        onChange={mockOnChange}
      />
    );

    const infoBox = screen.getByText(/Projects without a matching section/i).parentElement;
    expect(infoBox).toHaveClass('bg-muted/50', 'rounded-md', 'px-3', 'py-2', 'text-xs', 'text-muted-foreground');
  });
});
