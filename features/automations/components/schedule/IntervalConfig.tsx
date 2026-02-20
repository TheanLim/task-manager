'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useCallback } from 'react';
import type { ScheduleConfig } from './ScheduleConfigPanel';

export function IntervalConfig({
  schedule,
  onChange,
}: {
  schedule: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
}) {
  const mins = schedule.intervalMinutes ?? 30;
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>(() => {
    if (mins >= 1440 && mins % 1440 === 0) return 'days';
    if (mins >= 60 && mins % 60 === 0) return 'hours';
    return 'minutes';
  });
  const [displayValue, setDisplayValue] = useState(() => {
    if (unit === 'days') return mins / 1440;
    if (unit === 'hours') return mins / 60;
    return mins;
  });

  const getRange = (u: string) => {
    if (u === 'hours') return { min: 1, max: 168 };
    if (u === 'days') return { min: 1, max: 7 };
    return { min: 5, max: 60 };
  };

  const toMinutes = (val: number, u: string) => {
    if (u === 'days') return val * 1440;
    if (u === 'hours') return val * 60;
    return val;
  };

  const handleValueChange = useCallback(
    (val: number) => {
      setDisplayValue(val);
      onChange({ kind: 'interval', intervalMinutes: toMinutes(val, unit) });
    },
    [unit, onChange]
  );

  const handleUnitChange = useCallback(
    (newUnit: 'minutes' | 'hours' | 'days') => {
      setUnit(newUnit);
      const range = getRange(newUnit);
      const clamped = Math.max(range.min, Math.min(range.max, 1));
      setDisplayValue(clamped);
      onChange({ kind: 'interval', intervalMinutes: toMinutes(clamped, newUnit) });
    },
    [onChange]
  );

  const range = getRange(unit);

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Every</Label>
        <Input
          type="number"
          min={range.min}
          max={range.max}
          value={displayValue}
          onChange={(e) => handleValueChange(Number(e.target.value))}
          className="w-20"
          aria-label="Interval value"
        />
        <Select value={unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-28" aria-label="Interval unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">minutes</SelectItem>
            <SelectItem value="hours">hours</SelectItem>
            <SelectItem value="days">days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Minimum: 5 minutes. Maximum: 7 days.
      </p>
    </div>
  );
}
