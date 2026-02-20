'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCallback } from 'react';
import type { ScheduleConfig } from './ScheduleConfigPanel';

export function DueDateRelativeConfig({
  schedule,
  onChange,
}: {
  schedule: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
}) {
  const offsetMinutes = schedule.offsetMinutes ?? -1440;
  const displayUnit = (schedule.displayUnit ?? 'days') as 'minutes' | 'hours' | 'days';

  const unitMultiplier = displayUnit === 'days' ? 1440 : displayUnit === 'hours' ? 60 : 1;
  const absValue = Math.round(Math.abs(offsetMinutes) / unitMultiplier) || 1;
  const direction = offsetMinutes < 0 ? 'before' : 'after';

  const handleChange = useCallback(
    (val: number, unit: string, dir: string) => {
      const mult = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
      const offset = dir === 'before' ? -(val * mult) : val * mult;
      onChange({
        kind: 'due_date_relative',
        offsetMinutes: offset,
        displayUnit: unit,
      });
    },
    [onChange]
  );

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          min={1}
          value={absValue}
          onChange={(e) =>
            handleChange(Number(e.target.value), displayUnit, direction)
          }
          className="w-20"
          aria-label="Offset value"
        />
        <Select
          value={displayUnit}
          onValueChange={(v) => handleChange(absValue, v, direction)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">minutes</SelectItem>
            <SelectItem value="hours">hours</SelectItem>
            <SelectItem value="days">days</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={direction}
          onValueChange={(v) => handleChange(absValue, displayUnit, v)}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="before">before</SelectItem>
            <SelectItem value="after">after</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">due date</span>
      </div>
    </div>
  );
}
