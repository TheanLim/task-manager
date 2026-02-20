'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCallback } from 'react';
import type { ScheduleConfig } from './ScheduleConfigPanel';

function getTodayISO(): string {
  const d = new Date(Date.now());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatOneTimePreview(fireAt: string): string {
  const d = new Date(fireAt);
  if (isNaN(d.getTime())) return '';
  return `On ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

export function OneTimeConfig({
  schedule,
  onChange,
}: {
  schedule: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
}) {
  const fireAt = schedule.fireAt ?? '';
  const fireAtDate = fireAt ? new Date(fireAt) : null;

  const dateValue = fireAtDate && !isNaN(fireAtDate.getTime())
    ? `${fireAtDate.getFullYear()}-${String(fireAtDate.getMonth() + 1).padStart(2, '0')}-${String(fireAtDate.getDate()).padStart(2, '0')}`
    : '';
  const hour = fireAtDate && !isNaN(fireAtDate.getTime())
    ? fireAtDate.getHours()
    : 12;
  const minute = fireAtDate && !isNaN(fireAtDate.getTime())
    ? Math.floor(fireAtDate.getMinutes() / 5) * 5
    : 0;

  const todayISO = getTodayISO();

  const buildFireAt = useCallback(
    (date: string, h: number, m: number) => {
      if (!date) return;
      const [year, month, day] = date.split('-').map(Number);
      const local = new Date(year, month - 1, day, h, m, 0, 0);
      onChange({ kind: 'one_time', fireAt: local.toISOString() });
    },
    [onChange]
  );

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      buildFireAt(e.target.value, hour, minute);
    },
    [buildFireAt, hour, minute]
  );

  const isPast = fireAtDate ? fireAtDate.getTime() < Date.now() : false;
  const preview = fireAt ? formatOneTimePreview(fireAt) : '';

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Date</Label>
        <input
          type="date"
          min={todayISO}
          value={dateValue}
          onChange={handleDateChange}
          aria-label="Fire date"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">At</Label>
        <Select
          value={String(hour)}
          onValueChange={(v) => buildFireAt(dateValue, Number(v), minute)}
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
          onValueChange={(v) => buildFireAt(dateValue, hour, Number(v))}
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

      {preview && (
        <p className="text-sm text-muted-foreground">{preview}</p>
      )}

      {isPast && (
        <p className="text-sm text-amber-600">
          Selected time is in the past. The rule will fire immediately on save.
        </p>
      )}
    </div>
  );
}
