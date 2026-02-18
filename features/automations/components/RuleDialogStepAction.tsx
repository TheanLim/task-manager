'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionPicker } from './SectionPicker';
import { ACTION_META, type ActionConfig } from '../services/rulePreviewService';
import type { Section } from '@/lib/schemas';

interface RuleDialogStepActionProps {
  action: ActionConfig;
  onActionChange: (action: ActionConfig) => void;
  sections: Section[];
}

export function RuleDialogStepAction({
  action,
  onActionChange,
  sections,
}: RuleDialogStepActionProps) {
  // Group actions by category
  const moveActions = ACTION_META.filter((a) => a.category === 'move');
  const statusActions = ACTION_META.filter((a) => a.category === 'status');
  const dateActions = ACTION_META.filter((a) => a.category === 'dates');

  const handleActionTypeChange = (type: string) => {
    const actionMeta = ACTION_META.find((a) => a.type === type);
    onActionChange({
      type: type as ActionConfig['type'],
      sectionId: actionMeta?.needsSection ? action.sectionId : null,
      dateOption: actionMeta?.needsDateOption ? action.dateOption : null,
      position: actionMeta?.needsPosition ? action.position || 'top' : null,
    });
  };

  const handleSectionChange = (sectionId: string | null) => {
    onActionChange({
      ...action,
      sectionId,
    });
  };

  const handlePositionChange = (position: string) => {
    onActionChange({
      ...action,
      position: position as 'top' | 'bottom',
    });
  };

  const handleDateOptionChange = (dateOption: string) => {
    onActionChange({
      ...action,
      dateOption: dateOption as ActionConfig['dateOption'],
    });
  };

  const selectedActionMeta = action.type
    ? ACTION_META.find((a) => a.type === action.type)
    : null;

  return (
    <div className="space-y-4">
      {/* Move Category */}
      <Card className="border-l-4 border-l-sky-500">
        <CardHeader>
          <CardTitle className="text-base">Move</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {moveActions.map((actionMeta) => (
            <label
              key={actionMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="action"
                value={actionMeta.type}
                checked={action.type === actionMeta.type}
                onChange={(e) => handleActionTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1 space-y-2">
                <span className="text-sm">{actionMeta.label}</span>
                {action.type === actionMeta.type && actionMeta.needsSection && (
                  <div className="space-y-2">
                    <Select
                      value={action.position || 'top'}
                      onValueChange={handlePositionChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select position..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                    <SectionPicker
                      sections={sections}
                      value={action.sectionId}
                      onChange={handleSectionChange}
                      placeholder="Select section..."
                    />
                  </div>
                )}
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Status Category */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusActions.map((actionMeta) => (
            <label
              key={actionMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="action"
                value={actionMeta.type}
                checked={action.type === actionMeta.type}
                onChange={(e) => handleActionTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1">
                <span className="text-sm">{actionMeta.label}</span>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Dates Category */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="text-base">Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dateActions.map((actionMeta) => (
            <label
              key={actionMeta.type}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="action"
                value={actionMeta.type}
                checked={action.type === actionMeta.type}
                onChange={(e) => handleActionTypeChange(e.target.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
              />
              <div className="flex-1 space-y-2">
                <span className="text-sm">{actionMeta.label}</span>
                {action.type === actionMeta.type && actionMeta.needsDateOption && (
                  <Select
                    value={action.dateOption || undefined}
                    onValueChange={handleDateOptionChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select date..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Quick dates</SelectLabel>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                        <SelectItem value="next_working_day">Next working day</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
