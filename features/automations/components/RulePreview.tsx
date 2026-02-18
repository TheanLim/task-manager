import { Badge } from '@/components/ui/badge';
import { buildPreviewParts, type TriggerConfig, type ActionConfig } from '../services/rulePreviewService';
import type { Section } from '@/features/projects/schemas';

interface RulePreviewProps {
  trigger: TriggerConfig;
  action: ActionConfig;
  sections: Section[];
}

export function RulePreview({ trigger, action, sections }: RulePreviewProps) {
  // Create section lookup function
  const sectionLookup = (id: string) => {
    const section = sections.find((s) => s.id === id);
    return section?.name;
  };

  // Build preview parts
  const parts = buildPreviewParts(trigger, action, sectionLookup);

  return (
    <div
      className="rounded-md bg-muted px-4 py-3 text-sm"
      aria-live="polite"
      aria-atomic="true"
    >
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        } else {
          return (
            <Badge
              key={index}
              variant="secondary"
              className="bg-accent-brand/20 text-accent-brand"
            >
              {part.content}
            </Badge>
          );
        }
      })}
    </div>
  );
}
