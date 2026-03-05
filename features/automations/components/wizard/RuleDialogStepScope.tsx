'use client';

import { Check, Search } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
  onNext,
  onBack,
}: RuleDialogStepScopeProps) {
  const [localScope, setLocalScope] = useState<'all' | 'selected'>(scope === 'all_except' ? 'all' : scope);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(initialSelectedProjectIds);
  const firstRadioRef = useRef<HTMLButtonElement>(null);

  // Focus first radio option on mount
  useEffect(() => {
    if (firstRadioRef.current) {
      firstRadioRef.current.focus();
    }
  }, []);

  const handleScopeChange = (value: 'all' | 'selected') => {
    setLocalScope(value);
    setSelectedProjectIds(value === 'all' ? [] : selectedProjectIds);
    onChange({
      scope: value,
      selectedProjectIds: value === 'all' ? [] : selectedProjectIds,
    });
  };

  const handleToggleProject = (projectId: string) => {
    const newSelected = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds(newSelected);
    onChange({
      scope: localScope,
      selectedProjectIds: newSelected,
    });
  };

  const handleSelectAll = () => {
    const allIds = projects.map((p) => p.id);
    setSelectedProjectIds(allIds);
    onChange({
      scope: localScope,
      selectedProjectIds: allIds,
    });
  };

  const handleClear = () => {
    setSelectedProjectIds([]);
    onChange({
      scope: localScope,
      selectedProjectIds: [],
    });
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isValid = localScope === 'all' || selectedProjectIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Scope</h3>
        <p className="text-sm text-muted-foreground">
          Choose which projects this rule should apply to.
        </p>

        {/* Radio Group */}
        <RadioGroup
          value={localScope}
          onValueChange={handleScopeChange}
          className="grid gap-3"
          aria-label="Rule scope"
        >
          {/* All Projects Option */}
          <div
            className={`relative flex cursor-pointer items-center rounded-md border p-3 transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
              localScope === 'all'
                ? 'border-accent bg-accent/5 dark:bg-accent/10'
                : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
            }`}
          >
            <RadioGroupItem
              ref={firstRadioRef}
              value="all"
              id="scope-all"
              className="focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Label
              htmlFor="scope-all"
              className="ml-3 flex-1 cursor-pointer select-none text-base"
              tabIndex={-1}
            >
              All Projects
            </Label>
          </div>

          {/* Selected Projects Option */}
          <div
            className={`relative flex cursor-pointer items-center rounded-md border p-3 transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
              localScope === 'selected'
                ? 'border-accent bg-accent/5 dark:bg-accent/10'
                : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
            }`}
          >
            <RadioGroupItem
              value="selected"
              id="scope-selected"
              className="focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Label
              htmlFor="scope-selected"
              className="ml-3 flex-1 cursor-pointer select-none text-base"
              tabIndex={-1}
            >
              Selected Projects
            </Label>
          </div>
        </RadioGroup>

        {/* Expanded Project Picker (only when selected) */}
        {localScope === 'selected' && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <Command className="h-[350px] rounded-md border shadow-md" aria-label="Projects included in rule scope">
              <CommandInput
                placeholder="Search projects..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="h-9"
              />
              <CommandList>
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
            <div className="mt-2 flex items-center justify-between px-1">
              <div
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                {selectedProjectIds.length} of {projects.length} projects selected
              </div>

              {/* Select all / Clear buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredProjects.length === 0}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={selectedProjectIds.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Validation error */}
            {!isValid && (
              <p className="text-sm text-destructive mt-2">
                Select at least one project to continue.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!isValid}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
