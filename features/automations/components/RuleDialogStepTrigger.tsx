'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionPicker } from './SectionPicker';
import { TRIGGER_META, type TriggerConfig } from '../services/rulePreviewService';
import type { Section } from '@/lib/schemas';

interface RuleDialogStepTriggerProps {
  trigger: TriggerConfig;
  onTriggerChange: (trigger: TriggerConfig) => void;
  sections: Section[];
}

export function RuleDialogStepTrigger({
  trigger,
  onTriggerChange,
  sections,
}: RuleDialogStepTriggerProps) {
  // Group triggers by category
  const cardMoveTriggers = TRIGGER_META.filter((t) => t.category === 'card_move');
  const cardChangeTriggers = TRIGGER_META.filter((t) => t.category === 'card_change');
  const sectionChangeTriggers = TRIGGER_META.filter((t) => t.category === 'section_change');

  const handleTriggerTypeChange = (type: string) => {
    const triggerMeta = TRIGGER_META.find((t) => t.type === type);
    onTriggerChange({
      type: type as TriggerConfig['type'],
      sectionId: triggerMeta?.needsSection ? trigger.sectionId : null,
    });
  };

  const handleSectionChange = (sectionId: string | null) => {
    onTriggerChange({
      ...trigger,
      sectionId,
    });
  };

  const selectedTriggerMeta = trigger.type
    ? TRIGGER_META.find((t) => t.type === trigger.type)
    : null;

  return (
    <div className="space-y-4">
      {/* Card Move Category */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="text-base">Card Move</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cardMoveTriggers.map((triggerMeta) => (
            <label
              key={triggerMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="trigger"
                value={triggerMeta.type}
                checked={trigger.type === triggerMeta.type}
                onChange={(e) => handleTriggerTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1 space-y-2">
                <span className="text-sm">{triggerMeta.label}</span>
                {trigger.type === triggerMeta.type && triggerMeta.needsSection && (
                  <SectionPicker
                    sections={sections}
                    value={trigger.sectionId}
                    onChange={handleSectionChange}
                    placeholder="Select section..."
                  />
                )}
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Card Change Category */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader>
          <CardTitle className="text-base">Card Change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cardChangeTriggers.map((triggerMeta) => (
            <label
              key={triggerMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="trigger"
                value={triggerMeta.type}
                checked={trigger.type === triggerMeta.type}
                onChange={(e) => handleTriggerTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1">
                <span className="text-sm">{triggerMeta.label}</span>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Section Change Category */}
      <Card className="border-l-4 border-l-violet-500">
        <CardHeader>
          <CardTitle className="text-base">Section Change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sectionChangeTriggers.map((triggerMeta) => (
            <label
              key={triggerMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="trigger"
                value={triggerMeta.type}
                checked={trigger.type === triggerMeta.type}
                onChange={(e) => handleTriggerTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1">
                <span className="text-sm">{triggerMeta.label}</span>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
