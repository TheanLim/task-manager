'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  onSearch?: (query: string) => void;
}

export function SearchInput({ onSearch }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search tasks… (upcoming)"
        aria-label="Search tasks"
        className="h-8 w-48 rounded-md border border-transparent bg-muted/50 pl-8 pr-12 text-sm placeholder:text-muted-foreground focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <kbd className="pointer-events-none absolute right-2 flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </div>
  );
}
