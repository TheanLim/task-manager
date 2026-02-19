'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterRow } from './FilterRow';
import type { CardFilter, CardFilterType } from '../types';
import type { Section } from '@/lib/schemas';

interface RuleDialogStepFiltersProps {
  filters: CardFilter[];
  onFiltersChange: (filters: CardFilter[]) => void;
  onSkip: () => void;
  sections: Section[];
}

// Filter type metadata for the dropdown menu
const FILTER_CATEGORIES = [
  {
    label: 'Section',
    filters: [
      { type: 'in_section' as const, label: 'Card is in section' },
      { type: 'not_in_section' as const, label: 'Card is not in section' },
    ],
  },
  {
    label: 'Due Date Presence',
    filters: [
      { type: 'has_due_date' as const, label: 'Card has a due date' },
      { type: 'no_due_date' as const, label: 'Card has no due date' },
      { type: 'is_overdue' as const, label: 'Card is overdue' },
    ],
  },
  {
    label: 'Due Date - Positive',
    filters: [
      { type: 'due_today' as const, label: 'Card is due today' },
      { type: 'due_tomorrow' as const, label: 'Card is due tomorrow' },
      { type: 'due_this_week' as const, label: 'Card is due this week' },
      { type: 'due_next_week' as const, label: 'Card is due next week' },
      { type: 'due_this_month' as const, label: 'Card is due this month' },
      { type: 'due_next_month' as const, label: 'Card is due next month' },
    ],
  },
  {
    label: 'Due Date - Negative',
    filters: [
      { type: 'not_due_today' as const, label: 'Card is not due today' },
      { type: 'not_due_tomorrow' as const, label: 'Card is not due tomorrow' },
      { type: 'not_due_this_week' as const, label: 'Card is not due this week' },
      { type: 'not_due_next_week' as const, label: 'Card is not due next week' },
      { type: 'not_due_this_month' as const, label: 'Card is not due this month' },
      { type: 'not_due_next_month' as const, label: 'Card is not due next month' },
    ],
  },
  {
    label: 'Due Date - Comparison',
    filters: [
      { type: 'due_in_less_than' as const, label: 'Card due in less than...' },
      { type: 'due_in_more_than' as const, label: 'Card due in more than...' },
      { type: 'due_in_exactly' as const, label: 'Card due in exactly...' },
      { type: 'due_in_between' as const, label: 'Card due in between...' },
    ],
  },
];

export function RuleDialogStepFilters({
  filters,
  onFiltersChange,
  onSkip,
  sections,
}: RuleDialogStepFiltersProps) {
  const handleAddFilter = (filterType: CardFilterType) => {
    // Create a new filter with default values based on type
    let newFilter: CardFilter;

    if (filterType === 'in_section' || filterType === 'not_in_section') {
      newFilter = {
        type: filterType,
        sectionId: sections[0]?.id || '',
      };
    } else if (
      filterType === 'due_in_less_than' ||
      filterType === 'due_in_more_than' ||
      filterType === 'due_in_exactly'
    ) {
      newFilter = {
        type: filterType,
        value: 1,
        unit: 'days',
      };
    } else if (filterType === 'due_in_between') {
      newFilter = {
        type: filterType,
        minValue: 1,
        maxValue: 7,
        unit: 'days',
      };
    } else {
      // Simple filter types
      newFilter = { type: filterType };
    }

    onFiltersChange([...filters, newFilter]);
  };

  const handleFilterChange = (index: number, updatedFilter: CardFilter) => {
    const newFilters = [...filters];
    newFilters[index] = updatedFilter;
    onFiltersChange(newFilters);
  };

  const handleFilterRemove = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add optional filters to narrow down which cards this rule applies to. All
          filters must match for the rule to trigger.
        </p>

        {/* Filter List */}
        {filters.length > 0 && (
          <div className="space-y-2 border rounded-md p-3 bg-muted/30">
            {filters.map((filter, index) => (
              <FilterRow
                key={index}
                filter={filter}
                sections={sections}
                onChange={(updatedFilter) => handleFilterChange(index, updatedFilter)}
                onRemove={() => handleFilterRemove(index)}
              />
            ))}
          </div>
        )}

        {/* Add Filter Button */}
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px]">
              {FILTER_CATEGORIES.map((category, categoryIndex) => (
                <DropdownMenuGroup key={category.label}>
                  {categoryIndex > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{category.label}</DropdownMenuLabel>
                  {category.filters.map((filter) => (
                    <DropdownMenuItem
                      key={filter.type}
                      onClick={() => handleAddFilter(filter.type)}
                    >
                      {filter.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>

      {/* Info message when no filters */}
      {filters.length === 0 && (
        <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/10">
          No filters added. The rule will apply to all cards that match the trigger.
        </div>
      )}
    </div>
  );
}
