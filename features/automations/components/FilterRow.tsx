'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SectionPicker } from './SectionPicker';
import type { CardFilter } from '../types';
import type { Section } from '@/lib/schemas';

interface FilterRowProps {
  filter: CardFilter;
  sections: Section[];
  onChange: (filter: CardFilter) => void;
  onRemove: () => void;
}

export function FilterRow({ filter, sections, onChange, onRemove }: FilterRowProps) {
  // Section filters: "Card is [in/not in ▾] section [SectionPicker ▾]"
  if (filter.type === 'in_section' || filter.type === 'not_in_section') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">Card is</span>
        <Select
          value={filter.type}
          onValueChange={(value) =>
            onChange({
              ...filter,
              type: value as 'in_section' | 'not_in_section',
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_section">in</SelectItem>
            <SelectItem value="not_in_section">not in</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm">section</span>
        <div className="min-w-[200px]">
          <SectionPicker
            sections={sections}
            value={filter.sectionId}
            onChange={(sectionId) =>
              onChange({
                ...filter,
                sectionId: sectionId || '',
              })
            }
            placeholder="Select section..."
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Simple date filters: "Card [has a due date ▾]"
  if (
    filter.type === 'has_due_date' ||
    filter.type === 'no_due_date' ||
    filter.type === 'is_overdue' ||
    filter.type === 'due_today' ||
    filter.type === 'due_tomorrow' ||
    filter.type === 'due_this_week' ||
    filter.type === 'due_next_week' ||
    filter.type === 'due_this_month' ||
    filter.type === 'due_next_month' ||
    filter.type === 'not_due_today' ||
    filter.type === 'not_due_tomorrow' ||
    filter.type === 'not_due_this_week' ||
    filter.type === 'not_due_next_week' ||
    filter.type === 'not_due_this_month' ||
    filter.type === 'not_due_next_month'
  ) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">Card</span>
        <Select
          value={filter.type}
          onValueChange={(value) =>
            onChange({
              type: value as typeof filter.type,
            })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="has_due_date">has a due date</SelectItem>
            <SelectItem value="no_due_date">has no due date</SelectItem>
            <SelectItem value="is_overdue">is overdue</SelectItem>
            <SelectItem value="due_today">is due today</SelectItem>
            <SelectItem value="due_tomorrow">is due tomorrow</SelectItem>
            <SelectItem value="due_this_week">is due this week</SelectItem>
            <SelectItem value="due_next_week">is due next week</SelectItem>
            <SelectItem value="due_this_month">is due this month</SelectItem>
            <SelectItem value="due_next_month">is due next month</SelectItem>
            <SelectItem value="not_due_today">is not due today</SelectItem>
            <SelectItem value="not_due_tomorrow">is not due tomorrow</SelectItem>
            <SelectItem value="not_due_this_week">is not due this week</SelectItem>
            <SelectItem value="not_due_next_week">is not due next week</SelectItem>
            <SelectItem value="not_due_this_month">is not due this month</SelectItem>
            <SelectItem value="not_due_next_month">is not due next month</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Comparison filters: "Card due in [less than ▾] [N] [days ▾]"
  if (
    filter.type === 'due_in_less_than' ||
    filter.type === 'due_in_more_than' ||
    filter.type === 'due_in_exactly'
  ) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">Card due in</span>
        <Select
          value={filter.type}
          onValueChange={(value) =>
            onChange({
              ...filter,
              type: value as typeof filter.type,
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due_in_less_than">less than</SelectItem>
            <SelectItem value="due_in_more_than">more than</SelectItem>
            <SelectItem value="due_in_exactly">exactly</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="1"
          value={filter.value}
          onChange={(e) =>
            onChange({
              ...filter,
              value: parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-[80px]"
        />
        <Select
          value={filter.unit}
          onValueChange={(value) =>
            onChange({
              ...filter,
              unit: value as 'days' | 'working_days',
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">days</SelectItem>
            <SelectItem value="working_days">working days</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Between filter: "Card due in between [M] and [N] [days ▾]"
  if (filter.type === 'due_in_between') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">Card due in between</span>
        <Input
          type="number"
          min="1"
          value={filter.minValue}
          onChange={(e) =>
            onChange({
              ...filter,
              minValue: parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-[80px]"
        />
        <span className="text-sm">and</span>
        <Input
          type="number"
          min="1"
          value={filter.maxValue}
          onChange={(e) =>
            onChange({
              ...filter,
              maxValue: parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-[80px]"
        />
        <Select
          value={filter.unit}
          onValueChange={(value) =>
            onChange({
              ...filter,
              unit: value as 'days' | 'working_days',
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">days</SelectItem>
            <SelectItem value="working_days">working days</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Fallback for unknown filter types
  return null;
}
