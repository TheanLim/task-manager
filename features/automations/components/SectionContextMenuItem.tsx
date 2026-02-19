import { Zap } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { TriggerType } from '../types';

export interface SectionContextMenuItemProps {
  sectionId: string;
  projectId: string;
  onOpenRuleDialog: (prefill: { triggerType: TriggerType; sectionId: string }) => void;
}

export function SectionContextMenuItem({
  sectionId,
  onOpenRuleDialog,
}: SectionContextMenuItemProps) {
  return (
    <DropdownMenuItem
      onClick={() =>
        onOpenRuleDialog({
          triggerType: 'card_moved_into_section',
          sectionId,
        })
      }
    >
      <Zap className="mr-2 h-4 w-4" />
      ⚡ Add automation...
    </DropdownMenuItem>
  );
}
