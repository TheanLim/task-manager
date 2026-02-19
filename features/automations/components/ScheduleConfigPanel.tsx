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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useCallback, useEffect } from 'react';

interface ScheduleConfig {
  kind: string;
  intervalMinutes?: number;
  hour?: number;
  minute?: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  offsetMinutes?: number;
  displayUnit?: string;
}

interface ScheduleConfigPanelProps {
  triggerType: string;
  schedule: ScheduleConfig;
  onChange: (schedule: ScheduleConfig) => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function ScheduleConfigPanel({
  triggerType,
  schedule,
  onChange,
}: ScheduleConfigPanelProps) {
  if (triggerType === 'scheduled_interval') {
    return <IntervalConfig schedule={schedule} onChange={onChange} />;
  }
  if (triggerType === 'scheduled_cron') {
    return <CronConfig schedule={schedule} onChange={onChange} />;
  }
  if (triggerType === 'scheduled_due_date_relative') {
    return <DueDateRelativeConfig schedule={schedule} onChange={onChange} />;
  }
  return null;
}

// ─── Interval Config ────────────────────────────────────────────────────

function IntervalConfig({
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

// ─── Cron Config ────────────────────────────────────────────────────────

function CronConfig({
  schedule,
  onChange,
}: {
  schedule: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
}) {
  const hour = schedule.hour ?? 9;
  const minute = schedule.minute ?? 0;
  const daysOfWeek = schedule.daysOfWeek ?? [];
  const daysOfMonth = schedule.daysOfMonth ?? [];

  const [tab, setTab] = useState<string>(() => {
    if (daysOfMonth.length > 0) return 'monthly';
    if (daysOfWeek.length > 0) return 'weekly';
    return 'daily';
  });

  const emitChange = useCallback(
    (updates: Partial<ScheduleConfig>) => {
      onChange({
        kind: 'cron',
        hour,
        minute,
        daysOfWeek,
        daysOfMonth,
        ...updates,
      });
    },
    [hour, minute, daysOfWeek, daysOfMonth, onChange]
  );

  const handleTabChange = useCallback(
    (newTab: string) => {
      setTab(newTab);
      if (newTab === 'daily') {
        emitChange({ daysOfWeek: [], daysOfMonth: [] });
      } else if (newTab === 'weekly') {
        emitChange({ daysOfMonth: [] });
      } else if (newTab === 'monthly') {
        emitChange({ daysOfWeek: [], daysOfMonth: daysOfMonth.length > 0 ? daysOfMonth : [1] });
      }
    },
    [emitChange, daysOfMonth]
  );

  const toggleDay = useCallback(
    (day: number) => {
      const next = daysOfWeek.includes(day)
        ? daysOfWeek.filter((d) => d !== day)
        : [...daysOfWeek, day].sort();
      emitChange({ daysOfWeek: next, daysOfMonth: [] });
    },
    [daysOfWeek, emitChange]
  );

  const toggleWeekdays = useCallback(() => {
    const weekdays = [1, 2, 3, 4, 5];
    const allSelected = weekdays.every((d) => daysOfWeek.includes(d));
    emitChange({
      daysOfWeek: allSelected ? [] : weekdays,
      daysOfMonth: [],
    });
  }, [daysOfWeek, emitChange]);

  return (
    <div className="space-y-3 pt-2">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 pt-3">
          <Label className="text-sm">At</Label>
          <Select
            value={String(hour)}
            onValueChange={(v) => emitChange({ hour: Number(v) })}
          >
            <SelectTrigger className="w-20" aria-label="Hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {String(i).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">:</span>
          <Select
            value={String(minute)}
            onValueChange={(v) => emitChange({ minute: Number(v) })}
          >
            <SelectTrigger className="w-20" aria-label="Minute">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="daily">
          <p className="text-xs text-muted-foreground">
            Runs every day at the specified time.
          </p>
        </TabsContent>

        <TabsContent value="weekly">
          <div className="space-y-2">
            <div role="group" aria-label="Days of week" className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  role="switch"
                  aria-checked={daysOfWeek.includes(i)}
                  onClick={() => toggleDay(i)}
                  className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                    daysOfWeek.includes(i)
                      ? 'bg-accent-brand text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleWeekdays}
              className="text-xs text-accent-brand hover:underline"
            >
              Weekdays
            </button>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm">On day</Label>
              <Select
                value={String(daysOfMonth[0] ?? 1)}
                onValueChange={(v) =>
                  emitChange({ daysOfWeek: [], daysOfMonth: [Number(v)] })
                }
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm">of the month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Values &gt; 28 fire on last day in short months.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Due-Date-Relative Config ───────────────────────────────────────────

function DueDateRelativeConfig({
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
