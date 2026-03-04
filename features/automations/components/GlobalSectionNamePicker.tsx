'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Section } from '@/lib/schemas';

interface GlobalSectionNamePickerProps {
  /** All sections across all projects — deduplicated by name for display */
  allSections: Section[];
  /** Currently selected section name (not ID) */
  value: string | null;
  onChange: (sectionName: string | null) => void;
  placeholder?: string;
}

/**
 * Section picker for global rules. Shows deduplicated section names across all
 * projects. Stores the name (not an ID) so the rule can match any project's
 * section with that name at execution time.
 */
export function GlobalSectionNamePicker({
  allSections,
  value,
  onChange,
  placeholder = 'Type or select a section name...',
}: GlobalSectionNamePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value ?? '');

  // Sync input when value changes externally
  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  // Deduplicate section names (case-insensitive), preserve original casing of first occurrence
  const uniqueNames = React.useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const s of allSections) {
      const key = s.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        names.push(s.name.trim());
      }
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [allSections]);

  const filtered = React.useMemo(() => {
    if (!inputValue) return uniqueNames;
    const q = inputValue.toLowerCase();
    return uniqueNames.filter((n) => n.toLowerCase().includes(q));
  }, [uniqueNames, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    // Update parent with the typed value immediately (free-text allowed)
    onChange(v.trim() || null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        onChange(trimmed);
      }
      setOpen(false);
    }
  };

  const handleSelect = (name: string) => {
    setInputValue(name);
    onChange(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          onClick={() => setOpen(true)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-col">
          <div className="border-b px-3 py-2">
            <input
              type="text"
              placeholder="Type a section name..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {inputValue ? (
                  <>
                    <p>No existing section named &ldquo;{inputValue}&rdquo;.</p>
                    <p className="text-xs mt-1">It will be matched when found in a project.</p>
                  </>
                ) : (
                  'No sections found across your projects.'
                )}
              </div>
            ) : (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(name)}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value?.toLowerCase() === name.toLowerCase() && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value?.toLowerCase() === name.toLowerCase() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
