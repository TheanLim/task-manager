'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RelativeDateOption } from '../types';

interface DateOptionSelectProps {
  value: RelativeDateOption | null;
  onChange: (value: RelativeDateOption | null) => void;
  specificMonth?: number | null;
  specificDay?: number | null;
  monthTarget?: 'this_month' | 'next_month' | null;
  onSpecificMonthChange?: (month: number) => void;
  onSpecificDayChange?: (day: number) => void;
  onMonthTargetChange?: (target: 'this_month' | 'next_month') => void;
}

export function DateOptionSelect({
  value,
  onChange,
  specificMonth,
  specificDay,
  monthTarget,
  onSpecificMonthChange,
  onSpecificDayChange,
  onMonthTargetChange,
}: DateOptionSelectProps) {
  const showSpecificDatePickers = value === 'specific_date';
  const showMonthTargetToggle =
    value &&
    (value.startsWith('day_of_month_') ||
      value === 'last_day_of_month' ||
      value === 'last_working_day_of_month' ||
      value.includes('_of_month'));

  return (
    <div className="space-y-2">
      <Select value={value || undefined} onValueChange={(v) => onChange(v as RelativeDateOption)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select date..." />
        </SelectTrigger>
        <SelectContent>
          {/* Relative */}
          <SelectGroup>
            <SelectLabel>Relative</SelectLabel>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="tomorrow">Tomorrow</SelectItem>
            <SelectItem value="next_working_day">Next working day</SelectItem>
          </SelectGroup>

          {/* Next weekday */}
          <SelectGroup>
            <SelectLabel>Next weekday</SelectLabel>
            <SelectItem value="next_monday">Next Monday</SelectItem>
            <SelectItem value="next_tuesday">Next Tuesday</SelectItem>
            <SelectItem value="next_wednesday">Next Wednesday</SelectItem>
            <SelectItem value="next_thursday">Next Thursday</SelectItem>
            <SelectItem value="next_friday">Next Friday</SelectItem>
            <SelectItem value="next_saturday">Next Saturday</SelectItem>
            <SelectItem value="next_sunday">Next Sunday</SelectItem>
          </SelectGroup>

          {/* Next week */}
          <SelectGroup>
            <SelectLabel>Next week</SelectLabel>
            <SelectItem value="next_week_monday">Next week on Monday</SelectItem>
            <SelectItem value="next_week_tuesday">Next week on Tuesday</SelectItem>
            <SelectItem value="next_week_wednesday">Next week on Wednesday</SelectItem>
            <SelectItem value="next_week_thursday">Next week on Thursday</SelectItem>
            <SelectItem value="next_week_friday">Next week on Friday</SelectItem>
            <SelectItem value="next_week_saturday">Next week on Saturday</SelectItem>
            <SelectItem value="next_week_sunday">Next week on Sunday</SelectItem>
          </SelectGroup>

          {/* Monthly */}
          <SelectGroup>
            <SelectLabel>Monthly</SelectLabel>
            <SelectItem value="day_of_month_1">1st of month</SelectItem>
            <SelectItem value="day_of_month_2">2nd of month</SelectItem>
            <SelectItem value="day_of_month_3">3rd of month</SelectItem>
            <SelectItem value="day_of_month_4">4th of month</SelectItem>
            <SelectItem value="day_of_month_5">5th of month</SelectItem>
            <SelectItem value="day_of_month_6">6th of month</SelectItem>
            <SelectItem value="day_of_month_7">7th of month</SelectItem>
            <SelectItem value="day_of_month_8">8th of month</SelectItem>
            <SelectItem value="day_of_month_9">9th of month</SelectItem>
            <SelectItem value="day_of_month_10">10th of month</SelectItem>
            <SelectItem value="day_of_month_11">11th of month</SelectItem>
            <SelectItem value="day_of_month_12">12th of month</SelectItem>
            <SelectItem value="day_of_month_13">13th of month</SelectItem>
            <SelectItem value="day_of_month_14">14th of month</SelectItem>
            <SelectItem value="day_of_month_15">15th of month</SelectItem>
            <SelectItem value="day_of_month_16">16th of month</SelectItem>
            <SelectItem value="day_of_month_17">17th of month</SelectItem>
            <SelectItem value="day_of_month_18">18th of month</SelectItem>
            <SelectItem value="day_of_month_19">19th of month</SelectItem>
            <SelectItem value="day_of_month_20">20th of month</SelectItem>
            <SelectItem value="day_of_month_21">21st of month</SelectItem>
            <SelectItem value="day_of_month_22">22nd of month</SelectItem>
            <SelectItem value="day_of_month_23">23rd of month</SelectItem>
            <SelectItem value="day_of_month_24">24th of month</SelectItem>
            <SelectItem value="day_of_month_25">25th of month</SelectItem>
            <SelectItem value="day_of_month_26">26th of month</SelectItem>
            <SelectItem value="day_of_month_27">27th of month</SelectItem>
            <SelectItem value="day_of_month_28">28th of month</SelectItem>
            <SelectItem value="day_of_month_29">29th of month</SelectItem>
            <SelectItem value="day_of_month_30">30th of month</SelectItem>
            <SelectItem value="day_of_month_31">31st of month</SelectItem>
            <SelectItem value="last_day_of_month">Last day of month</SelectItem>
            <SelectItem value="last_working_day_of_month">Last working day of month</SelectItem>
          </SelectGroup>

          {/* Nth weekday of month */}
          <SelectGroup>
            <SelectLabel>Nth weekday of month</SelectLabel>
            <SelectItem value="first_monday_of_month">1st Monday of month</SelectItem>
            <SelectItem value="first_tuesday_of_month">1st Tuesday of month</SelectItem>
            <SelectItem value="first_wednesday_of_month">1st Wednesday of month</SelectItem>
            <SelectItem value="first_thursday_of_month">1st Thursday of month</SelectItem>
            <SelectItem value="first_friday_of_month">1st Friday of month</SelectItem>
            <SelectItem value="first_saturday_of_month">1st Saturday of month</SelectItem>
            <SelectItem value="first_sunday_of_month">1st Sunday of month</SelectItem>
            <SelectItem value="second_monday_of_month">2nd Monday of month</SelectItem>
            <SelectItem value="second_tuesday_of_month">2nd Tuesday of month</SelectItem>
            <SelectItem value="second_wednesday_of_month">2nd Wednesday of month</SelectItem>
            <SelectItem value="second_thursday_of_month">2nd Thursday of month</SelectItem>
            <SelectItem value="second_friday_of_month">2nd Friday of month</SelectItem>
            <SelectItem value="second_saturday_of_month">2nd Saturday of month</SelectItem>
            <SelectItem value="second_sunday_of_month">2nd Sunday of month</SelectItem>
            <SelectItem value="third_monday_of_month">3rd Monday of month</SelectItem>
            <SelectItem value="third_tuesday_of_month">3rd Tuesday of month</SelectItem>
            <SelectItem value="third_wednesday_of_month">3rd Wednesday of month</SelectItem>
            <SelectItem value="third_thursday_of_month">3rd Thursday of month</SelectItem>
            <SelectItem value="third_friday_of_month">3rd Friday of month</SelectItem>
            <SelectItem value="third_saturday_of_month">3rd Saturday of month</SelectItem>
            <SelectItem value="third_sunday_of_month">3rd Sunday of month</SelectItem>
            <SelectItem value="fourth_monday_of_month">4th Monday of month</SelectItem>
            <SelectItem value="fourth_tuesday_of_month">4th Tuesday of month</SelectItem>
            <SelectItem value="fourth_wednesday_of_month">4th Wednesday of month</SelectItem>
            <SelectItem value="fourth_thursday_of_month">4th Thursday of month</SelectItem>
            <SelectItem value="fourth_friday_of_month">4th Friday of month</SelectItem>
            <SelectItem value="fourth_saturday_of_month">4th Saturday of month</SelectItem>
            <SelectItem value="fourth_sunday_of_month">4th Sunday of month</SelectItem>
            <SelectItem value="last_monday_of_month">Last Monday of month</SelectItem>
            <SelectItem value="last_tuesday_of_month">Last Tuesday of month</SelectItem>
            <SelectItem value="last_wednesday_of_month">Last Wednesday of month</SelectItem>
            <SelectItem value="last_thursday_of_month">Last Thursday of month</SelectItem>
            <SelectItem value="last_friday_of_month">Last Friday of month</SelectItem>
            <SelectItem value="last_saturday_of_month">Last Saturday of month</SelectItem>
            <SelectItem value="last_sunday_of_month">Last Sunday of month</SelectItem>
          </SelectGroup>

          {/* Specific */}
          <SelectGroup>
            <SelectLabel>Specific</SelectLabel>
            <SelectItem value="specific_date">Specific date (month + day)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Month target toggle for monthly and nth-weekday options */}
      {showMonthTargetToggle && onMonthTargetChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">of</span>
          <Select
            value={monthTarget || 'this_month'}
            onValueChange={(v) => onMonthTargetChange(v as 'this_month' | 'next_month')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">this month</SelectItem>
              <SelectItem value="next_month">next month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Specific date pickers */}
      {showSpecificDatePickers && onSpecificMonthChange && onSpecificDayChange && (
        <div className="flex items-center gap-2">
          <Select
            value={specificMonth?.toString() || undefined}
            onValueChange={(v) => onSpecificMonthChange(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">January</SelectItem>
              <SelectItem value="2">February</SelectItem>
              <SelectItem value="3">March</SelectItem>
              <SelectItem value="4">April</SelectItem>
              <SelectItem value="5">May</SelectItem>
              <SelectItem value="6">June</SelectItem>
              <SelectItem value="7">July</SelectItem>
              <SelectItem value="8">August</SelectItem>
              <SelectItem value="9">September</SelectItem>
              <SelectItem value="10">October</SelectItem>
              <SelectItem value="11">November</SelectItem>
              <SelectItem value="12">December</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={specificDay?.toString() || undefined}
            onValueChange={(v) => onSpecificDayChange(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Day..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
