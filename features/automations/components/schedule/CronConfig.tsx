'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useCallback } from 'react';
import {
  parseCronExpression,
  toCronExpression,
  cronExpressionDescription,
} from '../../services/scheduler/cronExpressionParser';
import type { ScheduleConfig } from './ScheduleConfigPanel';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CronConfig({
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

  const [inputMode, setInputMode] = useState<'picker' | 'expression'>('picker');
  const [cronExpr, setCronExpr] = useState('');
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronDesc, setCronDesc] = useState<string | null>(null);

  const [tab, setTab] = useState<string>(() => {
    if (daysOfMonth.length > 0) return 'monthly';
    if (daysOfWeek.length > 0) return 'weekly';
    return 'daily';
  });

  const handleModeChange = useCallback(
    (mode: 'picker' | 'expression') => {
      setInputMode(mode);
      if (mode === 'expression') {
        const expr = toCronExpression({ hour, minute, daysOfWeek, daysOfMonth });
        setCronExpr(expr);
        setCronError(null);
        setCronDesc(cronExpressionDescription({ hour, minute, daysOfWeek, daysOfMonth }));
      } else {
        setCronError(null);
      }
    },
    [hour, minute, daysOfWeek, daysOfMonth]
  );

  const handleExpressionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCronExpr(value);

      if (!value.trim()) {
        setCronError(null);
        setCronDesc(null);
        return;
      }

      const result = parseCronExpression(value);
      if (result.success) {
        setCronError(null);
        setCronDesc(cronExpressionDescription(result.schedule));
        onChange({
          kind: 'cron',
          hour: result.schedule.hour,
          minute: result.schedule.minute,
          daysOfWeek: result.schedule.daysOfWeek,
          daysOfMonth: result.schedule.daysOfMonth,
        });
      } else {
        setCronError(result.error);
        setCronDesc(null);
      }
    },
    [onChange]
  );

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
      {/* Picker / Expression mode toggle */}
      <div role="radiogroup" aria-label="Input mode" className="flex gap-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="cron-input-mode"
            value="picker"
            checked={inputMode === 'picker'}
            onChange={() => handleModeChange('picker')}
            aria-label="Picker"
            className="accent-accent-brand"
          />
          <span className="text-sm">Picker</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="cron-input-mode"
            value="expression"
            checked={inputMode === 'expression'}
            onChange={() => handleModeChange('expression')}
            aria-label="Expression"
            className="accent-accent-brand"
          />
          <span className="text-sm">Expression</span>
        </label>
      </div>

      {inputMode === 'expression' ? (
        <div className="space-y-2">
          <input
            type="text"
            value={cronExpr}
            onChange={handleExpressionChange}
            placeholder="0 9 * * 1"
            aria-label="Cron expression"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          />
          {cronError && (
            <p className="text-xs text-destructive">{cronError}</p>
          )}
          {cronDesc && !cronError && (
            <p className="text-xs text-muted-foreground">{cronDesc}</p>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
