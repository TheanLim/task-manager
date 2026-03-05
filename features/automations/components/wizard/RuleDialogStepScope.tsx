'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

type RuleDialogStepScopeProps = {
  scope: 'all' | 'selected' | 'all_except';
  selectedProjectIds: string[];
  projects: Array<{ id: string; name: string }>;
  onChange: (updates: { scope: 'all' | 'selected'; selectedProjectIds: string[] }) => void;
  onNext: () => void;
  onBack: () => void;
};

export function RuleDialogStepScope({
  scope,
  selectedProjectIds: initialSelectedProjectIds,
  projects,
  onChange,
}: RuleDialogStepScopeProps) {
  const [localScope, setLocalScope] = useState<'all' | 'selected'>(
    scope === 'all_except' ? 'all' : scope,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    initialSelectedProjectIds,
  );
  const firstRadioRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRadioRef.current?.focus();
  }, []);

  const handleScopeChange = (value: 'all' | 'selected') => {
    setLocalScope(value);
    const ids = value === 'all' ? [] : selectedProjectIds;
    setSelectedProjectIds(ids);
    onChange({ scope: value, selectedProjectIds: ids });
  };

  const handleToggleProject = (projectId: string) => {
    const newSelected = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds(newSelected);
    onChange({ scope: localScope, selectedProjectIds: newSelected });
  };

  const handleSelectAll = () => {
    const allIds = projects.map((p) => p.id);
    setSelectedProjectIds(allIds);
    onChange({ scope: localScope, selectedProjectIds: allIds });
  };

  const handleClear = () => {
    setSelectedProjectIds([]);
    onChange({ scope: localScope, selectedProjectIds: [] });
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isValid = localScope === 'all' || selectedProjectIds.length > 0;

  const options: { value: 'all' | 'selected'; label: string; description: string }[] = [
    { value: 'all', label: 'All Projects', description: 'Runs in every project automatically.' },
    { value: 'selected', label: 'Selected Projects', description: 'Only runs in the projects you choose.' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Scope</h3>
        <p className="text-sm text-muted-foreground">
          Choose which projects this rule should apply to.
        </p>

        {/* Custom radio group per UX spec Q1 */}
        <div role="radiogroup" aria-label="Rule scope" className="grid gap-3">
          {options.map((opt, idx) => {
            const selected = localScope === opt.value;
            return (
              <button
                key={opt.value}
                ref={idx === 0 ? firstRadioRef : undefined}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleScopeChange(opt.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const next = options[(options.indexOf(opt) + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length];
                    handleScopeChange(next.value);
                    // Focus the other radio
                    const sibling = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                      `[aria-checked="${!selected}"]`,
                    );
                    sibling?.focus();
                  }
                }}
                className={cn(
                  'w-full text-left rounded-lg border px-4 py-3 transition-colors cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand focus-visible:ring-offset-2',
                  selected
                    ? 'border-accent-brand bg-accent-brand/5 dark:bg-accent-brand/10'
                    : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      selected ? 'border-accent-brand' : 'border-muted-foreground/40',
                    )}
                  >
                    {selected && <div className="w-2 h-2 rounded-full bg-accent-brand" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded Project Picker (only when selected) */}
        {localScope === 'selected' && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <Command className="rounded-md border shadow-md" aria-label="Projects included in rule scope">
              <CommandInput
                placeholder="Search projects..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="h-9"
                aria-label="Search projects to include in rule scope"
              />
              <CommandList className="max-h-48">
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  {filteredProjects.map((project) => {
                    const isSelected = selectedProjectIds.includes(project.id);
                    return (
                      <CommandItem
                        key={project.id}
                        onSelect={() => handleToggleProject(project.id)}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          checked={isSelected}
                          className="mr-2"
                          aria-hidden="true"
                          tabIndex={-1}
                          onCheckedChange={() => handleToggleProject(project.id)}
                        />
                        <span className="flex-1">{project.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-current" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>

            {/* Footer with count */}
            <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
              <div aria-live="polite">
                {selectedProjectIds.length} of {projects.length} projects selected
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={filteredProjects.length === 0}
                  className="hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={selectedProjectIds.length === 0}
                  className="hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Validation error */}
            {!isValid && (
              <p className="text-destructive text-xs mt-2">
                Select at least one project to continue.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
