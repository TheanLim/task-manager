'use client';

import { useState } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExecutionLogFilters, OutcomeFilter, DateRangeFilter } from '../services/preview/logFilterService';

interface ExecutionLogFilterBarProps {
  filters: ExecutionLogFilters;
  onSetRuleIds: (ids: string[]) => void;
  onSetProjectIds: (ids: string[]) => void;
  onSetOutcome: (outcome: OutcomeFilter) => void;
  onSetDateRange: (range: DateRangeFilter) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
}

// Mock data for rules and projects - in a real app, these would come from props or context
const MOCK_RULES = [
  { id: 'rule-1', name: 'Move overdue tasks' },
  { id: 'rule-2', name: 'Complete Friday tasks' },
  { id: 'rule-3', name: 'Archive old tasks' },
];

const MOCK_PROJECTS = [
  { id: 'project-1', name: 'Personal' },
  { id: 'project-2', name: 'Work' },
  { id: 'project-3', name: 'Side Projects' },
];

export function ExecutionLogFilterBar({
  filters,
  onSetRuleIds,
  onSetProjectIds,
  onSetOutcome,
  onSetDateRange,
  onClearFilters,
  hasActiveFilters,
  filteredCount,
  totalCount,
}: ExecutionLogFilterBarProps) {
  const [rulePopoverOpen, setRulePopoverOpen] = useState(false);
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [outcomeDropdownOpen, setOutcomeDropdownOpen] = useState(false);
  const [dateRangeDropdownOpen, setDateRangeDropdownOpen] = useState(false);

  const getOutcomeBadgeClass = (outcome: OutcomeFilter) => {
    switch (outcome) {
      case 'fired': return 'text-emerald-600';
      case 'skipped': return 'text-amber-600';
      case 'error': return 'text-destructive';
      default: return '';
    }
  };

  const getOutcomeLabel = (outcome: OutcomeFilter) => {
    switch (outcome) {
      case 'all': return 'All outcomes';
      case 'fired': return 'Fired';
      case 'skipped': return 'Skipped';
      case 'error': return 'Error';
    }
  };

  const getDateRangeLabel = (range: DateRangeFilter) => {
    switch (range) {
      case 'all': return 'All time';
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      default: return 'Last 7 days';
    }
  };

  const getAriaLabel = (type: 'rule' | 'project' | 'outcome' | 'date', count: number, total: number) => {
    const typeLabel = type === 'rule' ? 'rules' : type === 'project' ? 'projects' : type;
    if (count > 0) {
      return `Filter by ${type}. ${count} selected`;
    }
    return `Filter by ${type}. All ${typeLabel}`;
  };

  const isRuleFilterActive = filters.ruleIds.length > 0;
  const isProjectFilterActive = filters.projectIds.length > 0;
  const isOutcomeFilterActive = filters.outcome !== 'all';
  const isDateFilterActive = filters.dateRange !== '7d';

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card">
      <div className="flex flex-wrap items-center gap-2">
        {/* Rule Filter Button */}
        <Popover open={rulePopoverOpen} onOpenChange={setRulePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${isRuleFilterActive ? 'border-accent-brand text-accent-brand' : ''}`}
              aria-label={getAriaLabel('rule', filters.ruleIds.length, MOCK_RULES.length)}
            >
              <Filter className="h-3 w-3" />
              Rule
              {isRuleFilterActive && (
                <Badge variant="secondary" className="ml-1">
                  {filters.ruleIds.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search rules..." />
              <CommandList>
                <CommandEmpty>No rules found.</CommandEmpty>
                <CommandGroup>
                  {MOCK_RULES.map((rule) => (
                    <CommandItem
                      key={rule.id}
                      onSelect={() => {
                        const newIds = filters.ruleIds.includes(rule.id)
                          ? filters.ruleIds.filter(id => id !== rule.id)
                          : [...filters.ruleIds, rule.id];
                        onSetRuleIds(newIds);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        checked={filters.ruleIds.includes(rule.id)}
                        onCheckedChange={(checked) => {
                          const newIds = checked
                            ? [...filters.ruleIds, rule.id]
                            : filters.ruleIds.filter(id => id !== rule.id);
                          onSetRuleIds(newIds);
                        }}
                      />
                      <span>{rule.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Project Filter Button */}
        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${isProjectFilterActive ? 'border-accent-brand text-accent-brand' : ''}`}
              aria-label={getAriaLabel('project', filters.projectIds.length, MOCK_PROJECTS.length)}
            >
              <Filter className="h-3 w-3" />
              Project
              {isProjectFilterActive && (
                <Badge variant="secondary" className="ml-1">
                  {filters.projectIds.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search projects..." />
              <CommandList>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  {MOCK_PROJECTS.map((project) => (
                    <CommandItem
                      key={project.id}
                      onSelect={() => {
                        const newIds = filters.projectIds.includes(project.id)
                          ? filters.projectIds.filter(id => id !== project.id)
                          : [...filters.projectIds, project.id];
                        onSetProjectIds(newIds);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        checked={filters.projectIds.includes(project.id)}
                        onCheckedChange={(checked) => {
                          const newIds = checked
                            ? [...filters.projectIds, project.id]
                            : filters.projectIds.filter(id => id !== project.id);
                          onSetProjectIds(newIds);
                        }}
                      />
                      <span>{project.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Outcome Filter Button */}
        <DropdownMenu open={outcomeDropdownOpen} onOpenChange={setOutcomeDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${isOutcomeFilterActive ? 'border-accent-brand text-accent-brand' : ''}`}
              aria-label={getAriaLabel('outcome', isOutcomeFilterActive ? 1 : 0, 4)}
            >
              <Filter className="h-3 w-3" />
              Outcome
              {isOutcomeFilterActive && (
                <Badge variant="outline" className={`ml-1 ${getOutcomeBadgeClass(filters.outcome)}`}>
                  {getOutcomeLabel(filters.outcome)}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onSetOutcome('all')}>
              All outcomes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetOutcome('fired')}>
              <Badge variant="outline" className="text-emerald-600 mr-2">Fired</Badge>
              Fired
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetOutcome('skipped')}>
              <Badge variant="outline" className="text-amber-600 mr-2">Skipped</Badge>
              Skipped
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetOutcome('error')}>
              <Badge variant="outline" className="text-destructive mr-2">Error</Badge>
              Error
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Range Filter Button */}
        <DropdownMenu open={dateRangeDropdownOpen} onOpenChange={setDateRangeDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${isDateFilterActive ? 'border-accent-brand text-accent-brand' : ''}`}
              aria-label={getAriaLabel('date', isDateFilterActive ? 1 : 0, 4)}
            >
              <Filter className="h-3 w-3" />
              Date
              {isDateFilterActive && (
                <Badge variant="secondary" className="ml-1">
                  {getDateRangeLabel(filters.dateRange)}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onSetDateRange('24h')}>
              Last 24 hours
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDateRange('7d')}>
              Last 7 days
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDateRange('all')}>
              All time
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="gap-2 ml-auto"
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Count Text */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredCount} entries (filtered from {totalCount} total)
      </div>
    </div>
  );
}