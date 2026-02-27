'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TMSModeOption } from './TMSModeOption';

interface TMSModePopoverProps {
  open: boolean;
  activeSystem: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  children?: React.ReactNode;
}

const MODES = [
  { id: 'none', keyHint: '0' },
  { id: 'af4', keyHint: '1' },
  { id: 'dit', keyHint: '2' },
  { id: 'fvp', keyHint: '3' },
  { id: 'standard', keyHint: '4' },
] as const;

type ModeId = (typeof MODES)[number]['id'];

const KEY_TO_MODE: Record<string, ModeId> = {
  '0': 'none',
  '1': 'af4',
  '2': 'dit',
  '3': 'fvp',
  '4': 'standard',
};

export function TMSModePopover({
  open,
  activeSystem,
  onSelect,
  onClose,
  children,
}: TMSModePopoverProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    const idx = MODES.findIndex((m) => m.id === activeSystem);
    return idx >= 0 ? idx : 0;
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset focused index when popover opens
  useEffect(() => {
    if (open) {
      const idx = MODES.findIndex((m) => m.id === activeSystem);
      setFocusedIndex(idx >= 0 ? idx : 0);
      // Auto-focus the container so keydown events are captured
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  }, [open, activeSystem]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % MODES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + MODES.length) % MODES.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const mode = MODES[focusedIndex];
        onSelect(mode.id);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (KEY_TO_MODE[e.key]) {
        e.preventDefault();
        onSelect(KEY_TO_MODE[e.key]);
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, focusedIndex, onSelect, onClose]);

  return (
    <Popover open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 p-1 bg-zinc-900 border-zinc-700 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-150"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={containerRef}
          role="listbox"
          tabIndex={-1}
          aria-label="Select review mode"
          className="outline-none"
        >
          {MODES.map((mode, index) => (
            <TMSModeOption
              key={mode.id}
              id={mode.id}
              isSelected={mode.id === activeSystem}
              isFocused={index === focusedIndex}
              keyHint={mode.keyHint}
              onSelect={(id) => {
                onSelect(id);
                onClose();
              }}
              onFocus={() => setFocusedIndex(index)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
