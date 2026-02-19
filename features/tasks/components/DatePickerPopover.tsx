'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

interface DatePickerPopoverProps {
  value: string | null;
  onChange: (date: string | null) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'end';
  onTriggerClick?: (e: React.MouseEvent) => void;
}

export function DatePickerPopover({ value, onChange, trigger, align = 'start', onTriggerClick }: DatePickerPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div onClick={onTriggerClick}>
          {trigger}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align} onClick={(e) => e.stopPropagation()}>
        <CalendarComponent
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => {
            onChange(date?.toISOString() || null);
          }}
          initialFocus
        />
        {value && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(null)}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
