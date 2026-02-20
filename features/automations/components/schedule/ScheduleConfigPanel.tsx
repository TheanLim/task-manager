'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IntervalConfig } from './IntervalConfig';
import { CronConfig } from './CronConfig';
import { OneTimeConfig } from './OneTimeConfig';
import { DueDateRelativeConfig } from './DueDateRelativeConfig';

export interface ScheduleConfig {
  kind: string;
  intervalMinutes?: number;
  hour?: number;
  minute?: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  offsetMinutes?: number;
  displayUnit?: string;
  fireAt?: string;
}

interface ScheduleConfigPanelProps {
  triggerType: string;
  schedule: ScheduleConfig;
  onChange: (schedule: ScheduleConfig) => void;
  catchUpPolicy?: 'catch_up_latest' | 'skip_missed';
  onCatchUpPolicyChange?: (policy: 'catch_up_latest' | 'skip_missed') => void;
}

export function ScheduleConfigPanel({
  triggerType,
  schedule,
  onChange,
  catchUpPolicy,
  onCatchUpPolicyChange,
}: ScheduleConfigPanelProps) {
  let scheduleConfig: React.ReactNode = null;

  if (triggerType === 'scheduled_interval') {
    scheduleConfig = <IntervalConfig schedule={schedule} onChange={onChange} />;
  } else if (triggerType === 'scheduled_cron') {
    scheduleConfig = <CronConfig schedule={schedule} onChange={onChange} />;
  } else if (triggerType === 'scheduled_due_date_relative') {
    scheduleConfig = <DueDateRelativeConfig schedule={schedule} onChange={onChange} />;
  } else if (triggerType === 'scheduled_one_time') {
    scheduleConfig = <OneTimeConfig schedule={schedule} onChange={onChange} />;
  } else {
    return null;
  }

  return (
    <div className="space-y-4">
      {scheduleConfig}

      {/* Catch-up policy toggle */}
      {catchUpPolicy !== undefined && onCatchUpPolicyChange && (
        <div className="space-y-1 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="catch-up-toggle" className="text-sm">
              Run on catch-up
            </Label>
            <Switch
              id="catch-up-toggle"
              aria-label="Run on catch-up"
              checked={catchUpPolicy === 'catch_up_latest'}
              onCheckedChange={(checked) =>
                onCatchUpPolicyChange(checked ? 'catch_up_latest' : 'skip_missed')
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            When disabled, this rule won&apos;t fire for missed schedules when the app reopens.
          </p>
        </div>
      )}

      {/* Template helper text */}
      <p className="text-xs text-muted-foreground">
        Use {'{{date}}'}, {'{{day}}'}, {'{{weekday}}'}, {'{{month}}'} for dynamic titles
      </p>
    </div>
  );
}
