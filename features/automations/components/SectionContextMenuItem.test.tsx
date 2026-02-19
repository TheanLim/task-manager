import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionContextMenuItem } from './SectionContextMenuItem';

function renderInDropdown(ui: React.ReactElement) {
  return render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>{ui}</DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('SectionContextMenuItem', () => {
  const defaultProps = {
    sectionId: 'section-1',
    projectId: 'project-1',
    onOpenRuleDialog: vi.fn(),
  };

  it('renders with correct label text', () => {
    renderInDropdown(<SectionContextMenuItem {...defaultProps} />);

    expect(screen.getByText(/Add automation/)).toBeInTheDocument();
  });

  it('calls onOpenRuleDialog with correct prefill data on click', async () => {
    const onOpenRuleDialog = vi.fn();
    const user = userEvent.setup();

    renderInDropdown(
      <SectionContextMenuItem
        {...defaultProps}
        sectionId="section-42"
        onOpenRuleDialog={onOpenRuleDialog}
      />
    );

    await user.click(screen.getByText(/Add automation/));

    expect(onOpenRuleDialog).toHaveBeenCalledOnce();
    expect(onOpenRuleDialog).toHaveBeenCalledWith({
      triggerType: 'card_moved_into_section',
      sectionId: 'section-42',
    });
  });
});
