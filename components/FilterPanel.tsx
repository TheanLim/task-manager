'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useFilterStore } from '@/stores/filterStore';
import { useAppStore } from '@/stores/appStore';
import { Priority } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

export function FilterPanel() {
  const {
    priorityFilter,
    dateRangeFilter,
    completionFilter,
    setPriorityFilter,
    setDateRangeFilter,
    setCompletionFilter,
    clearFilters,
  } = useFilterStore();

  const { settings, setShowOnlyActionableTasks } = useAppStore();

  const hasActiveFilters =
    priorityFilter !== null ||
    (dateRangeFilter !== null && (dateRangeFilter.start !== null || dateRangeFilter.end !== null)) ||
    completionFilter !== 'all' ||
    settings.showOnlyActionableTasks;

  return (
    <div className="space-y-4 rounded-lg shadow-elevation-base bg-card p-4 dark:border-t dark:border-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearFilters();
              setShowOnlyActionableTasks(false);
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {/* Priority Filter */}
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={priorityFilter || 'all'}
            onValueChange={(value) =>
              setPriorityFilter(value === 'all' ? null : (value as Priority))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label>Due Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end ? (
                  <>
                    {format(dateRangeFilter.start, 'PP')} -{' '}
                    {format(dateRangeFilter.end, 'PP')}
                  </>
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 space-y-2">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Calendar
                    mode="single"
                    selected={dateRangeFilter?.start || undefined}
                    onSelect={(date) => {
                      if (date) {
                        setDateRangeFilter(
                          date,
                          dateRangeFilter?.end ||
                            new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)
                        );
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Calendar
                    mode="single"
                    selected={dateRangeFilter?.end || undefined}
                    onSelect={(date) => {
                      if (date && dateRangeFilter?.start) {
                        setDateRangeFilter(dateRangeFilter.start, date);
                      }
                    }}
                    disabled={(date) =>
                      dateRangeFilter?.start
                        ? date < dateRangeFilter.start
                        : false
                    }
                  />
                </div>
                {dateRangeFilter && (dateRangeFilter.start || dateRangeFilter.end) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRangeFilter(null, null)}
                    className="w-full"
                  >
                    Clear date range
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Completion Status Filter */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={
              completionFilter === null
                ? 'all'
                : completionFilter === 'completed'
                ? 'completed'
                : 'incomplete'
            }
            onValueChange={(value) => {
              if (value === 'all') {
                setCompletionFilter('all');
              } else if (value === 'completed') {
                setCompletionFilter('completed');
              } else {
                setCompletionFilter('incomplete');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actionable Tasks Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="actionable"
            checked={settings.showOnlyActionableTasks}
            onCheckedChange={(checked) =>
              setShowOnlyActionableTasks(checked === true)
            }
          />
          <Label
            htmlFor="actionable"
            className="text-sm font-normal cursor-pointer"
          >
            Show only actionable tasks
          </Label>
        </div>
      </div>
    </div>
  );
}
