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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Section } from '@/lib/schemas';

interface SectionPickerProps {
  sections: Section[];
  value: string | null;
  onChange: (sectionId: string | null) => void;
  placeholder?: string;
}

export function SectionPicker({
  sections,
  value,
  onChange,
  placeholder = 'Select section...',
}: SectionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Simple Select for 5 or fewer sections
  if (sections.length <= 5) {
    return (
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {sections.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              {section.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Searchable Popover + Command-style list for more than 5 sections
  const filteredSections = React.useMemo(() => {
    if (!searchQuery) return sections;
    const query = searchQuery.toLowerCase();
    return sections.filter((section) =>
      section.name.toLowerCase().includes(query)
    );
  }, [sections, searchQuery]);

  const selectedSection = sections.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedSection ? selectedSection.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-col">
          <div className="border-b px-3 py-2">
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredSections.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No sections found.
              </div>
            ) : (
              <div className="p-1">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      onChange(section.id);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className={cn(
                      'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      value === section.id && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === section.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {section.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
