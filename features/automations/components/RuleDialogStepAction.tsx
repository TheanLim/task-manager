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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SectionPicker } from './SectionPicker';
import { DateOptionSelect } from './DateOptionSelect';
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
  const createActions = ACTION_META.filter((a) => a.category === 'create');

  const handleActionTypeChange = (type: string) => {
    const actionMeta = ACTION_META.find((a) => a.type === type);
    onActionChange({
      type: type as ActionConfig['type'],
      sectionId: actionMeta?.needsSection ? action.sectionId : null,
      dateOption: actionMeta?.needsDateOption ? action.dateOption : null,
      position: actionMeta?.needsPosition ? action.position || 'top' : null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
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

  const handleCardTitleChange = (cardTitle: string) => {
    onActionChange({
      ...action,
      cardTitle,
    });
  };

  const handleCardDateOptionChange = (cardDateOption: string | null) => {
    onActionChange({
      ...action,
      cardDateOption: cardDateOption as ActionConfig['cardDateOption'],
    });
  };

  const handleSpecificMonthChange = (specificMonth: number) => {
    onActionChange({
      ...action,
      specificMonth,
    });
  };

  const handleSpecificDayChange = (specificDay: number) => {
    onActionChange({
      ...action,
      specificDay,
    });
  };

  const handleMonthTargetChange = (monthTarget: 'this_month' | 'next_month') => {
    onActionChange({
      ...action,
      monthTarget,
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
                  <DateOptionSelect
                    value={action.dateOption}
                    onChange={(v) => handleDateOptionChange(v || '')}
                    specificMonth={action.specificMonth}
                    specificDay={action.specificDay}
                    monthTarget={action.monthTarget}
                    onSpecificMonthChange={handleSpecificMonthChange}
                    onSpecificDayChange={handleSpecificDayChange}
                    onMonthTargetChange={handleMonthTargetChange}
                  />
                )}
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Create/Remove Category */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="text-base">Create/Remove</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {createActions.map((actionMeta) => (
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
                {action.type === actionMeta.type && actionMeta.needsTitle && (
                  <div className="space-y-2">
                    <Label htmlFor="card-title">Card title</Label>
                    <Input
                      id="card-title"
                      type="text"
                      placeholder="Enter card title..."
                      value={action.cardTitle || ''}
                      onChange={(e) => handleCardTitleChange(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                )}
                {action.type === actionMeta.type && actionMeta.needsSection && (
                  <SectionPicker
                    sections={sections}
                    value={action.sectionId}
                    onChange={handleSectionChange}
                    placeholder="Select section..."
                  />
                )}
                {action.type === actionMeta.type && actionMeta.needsCardDateOption && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="set-due-date"
                        checked={action.cardDateOption !== null}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleCardDateOptionChange('today');
                          } else {
                            handleCardDateOptionChange(null);
                          }
                        }}
                      />
                      <Label htmlFor="set-due-date" className="cursor-pointer">
                        Set due date
                      </Label>
                    </div>
                    {action.cardDateOption !== null && (
                      <DateOptionSelect
                        value={action.cardDateOption}
                        onChange={handleCardDateOptionChange}
                        specificMonth={action.specificMonth}
                        specificDay={action.specificDay}
                        monthTarget={action.monthTarget}
                        onSpecificMonthChange={handleSpecificMonthChange}
                        onSpecificDayChange={handleSpecificDayChange}
                        onMonthTargetChange={handleMonthTargetChange}
                      />
                    )}
                  </div>
                )}
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
