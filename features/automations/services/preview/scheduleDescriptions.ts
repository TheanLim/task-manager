/**
 * Human-readable descriptions for scheduled trigger configurations.
 * Pure functions — no side effects, no repository access.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Describe a schedule configuration in human-readable form.
 * Used in preview sentences and rule cards.
 */
export function describeSchedule(trigger: { type: string; schedule?: any }): string {
  if (!trigger.schedule) return 'Unknown';

  switch (trigger.type) {
    case 'scheduled_interval': {
      const mins = trigger.schedule.intervalMinutes;
      if (mins >= 1440 && mins % 1440 === 0) return `${mins / 1440} day${mins / 1440 > 1 ? 's' : ''}`;
      if (mins >= 60 && mins % 60 === 0) return `${mins / 60} hour${mins / 60 > 1 ? 's' : ''}`;
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }

    case 'scheduled_cron': {
      const { hour, minute, daysOfWeek, daysOfMonth } = trigger.schedule;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      if (daysOfWeek?.length > 0) {
        const days = daysOfWeek.map((d: number) => DAY_NAMES[d]).join(', ');
        return `${days} at ${time}`;
      }
      if (daysOfMonth?.length > 0) {
        const ordinal = (n: number) => {
          const s = ['th', 'st', 'nd', 'rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        const days = daysOfMonth.map(ordinal).join(', ');
        return `${days} of month at ${time}`;
      }
      return `day at ${time}`;
    }

    case 'scheduled_due_date_relative': {
      const { offsetMinutes, displayUnit } = trigger.schedule;
      const abs = Math.abs(offsetMinutes);
      const direction = offsetMinutes < 0 ? 'before' : 'after';
      let value: number;
      let unit: string;

      if (displayUnit === 'days' || (!displayUnit && abs >= 1440)) {
        value = Math.round(abs / 1440);
        unit = value === 1 ? 'day' : 'days';
      } else if (displayUnit === 'hours' || (!displayUnit && abs >= 60)) {
        value = Math.round(abs / 60);
        unit = value === 1 ? 'hour' : 'hours';
      } else {
        value = abs;
        unit = value === 1 ? 'minute' : 'minutes';
      }

      return `${value} ${unit} ${direction} due date`;
    }

    case 'scheduled_one_time': {
      return `On ${formatFireAt(trigger.schedule.fireAt)}`;
    }

    default:
      return 'Unknown';
  }
}

/**
 * Compute a human-readable "next run" description for a scheduled trigger.
 * Used on the Rule Card to show when the rule will fire next.
 */
export function computeNextRunDescription(
  trigger: { type: string; schedule?: any; lastEvaluatedAt?: string | null },
  nowMs: number,
  enabled: boolean = true
): string {
  if (!trigger.schedule) return 'Unknown';

  switch (trigger.type) {
    case 'scheduled_interval': {
      const intervalMs = trigger.schedule.intervalMinutes * 60 * 1000;
      if (!trigger.lastEvaluatedAt) return 'On next tick';
      const lastMs = new Date(trigger.lastEvaluatedAt).getTime();
      const nextMs = lastMs + intervalMs;
      const diffMs = nextMs - nowMs;
      if (diffMs <= 0) return 'On next tick';
      return `in ${formatDuration(diffMs)}`;
    }

    case 'scheduled_cron': {
      return `Next: ${describeSchedule(trigger)}`;
    }

    case 'scheduled_due_date_relative':
      return 'Checks on next tick';

    case 'scheduled_one_time': {
      const fireAtMs = new Date(trigger.schedule.fireAt).getTime();
      const fireDate = new Date(trigger.schedule.fireAt);
      const dateStr = formatShortDate(fireDate);

      if (!enabled) {
        return `Fired on ${dateStr}`;
      }

      // Check if firing today
      const nowDate = new Date(nowMs);
      const isSameDay =
        fireDate.getUTCFullYear() === nowDate.getUTCFullYear() &&
        fireDate.getUTCMonth() === nowDate.getUTCMonth() &&
        fireDate.getUTCDate() === nowDate.getUTCDate();

      if (isSameDay) {
        const time = `${String(fireDate.getUTCHours()).padStart(2, '0')}:${String(fireDate.getUTCMinutes()).padStart(2, '0')}`;
        return `Fires today at ${time}`;
      }

      const diffDays = Math.round((fireAtMs - nowMs) / (1000 * 60 * 60 * 24));
      return `Fires on ${dateStr} (in ${diffDays} day${diffDays === 1 ? '' : 's'})`;
    }

    default:
      return 'Unknown';
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/**
 * Format a Date as "Mon DD, YYYY" using UTC values.
 */
export function formatShortDate(date: Date): string {
  const month = MONTH_ABBREVS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Format an ISO datetime string as "Mon DD, YYYY at HH:MM" using UTC values.
 */
export function formatFireAt(fireAt: string): string {
  const date = new Date(fireAt);
  const dateStr = formatShortDate(date);
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${dateStr} at ${time}`;
}
