'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useCrossTabSync } from '@/lib/hooks/useCrossTabSync';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

/**
 * Main layout component with responsive sidebar
 */
export function Layout({ children, sidebar, header }: LayoutProps) {
  useCrossTabSync();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prevSidebarOpen = useRef(sidebarOpen);

  const minWidth = 200;
  const maxWidth = 600;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sidebarOpen) return;
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Focus management: move focus into sidebar when opened via toggle
  useEffect(() => {
    if (sidebarOpen && !prevSidebarOpen.current && sidebarRef.current) {
      // Sidebar just opened — focus the first interactive element inside
      requestAnimationFrame(() => {
        const firstFocusable = sidebarRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
    }
    prevSidebarOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  // Escape key in sidebar: return focus to toggle button
  const handleSidebarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      toggleRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header - always visible at top */}
      <header className="flex h-12 items-center gap-3 shadow-elevation-base bg-card px-4 flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={toggleRef}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{sidebarOpen ? 'Close sidebar' : 'Open sidebar'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* TODO: Replace this placeholder dot with actual app logo/favicon when branding is finalized */}
        <span className="w-2 h-2 rounded-full bg-accent-brand" aria-hidden="true" />

        {header && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex flex-1 items-center justify-between">
              {header}
            </div>
          </>
        )}
      </header>

      {/* Content area below header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={cn(
            "relative bg-card flex-shrink-0 transition-[transform,margin] duration-200 ease-out overflow-hidden dark:border-r dark:border-white/5",
            !sidebarOpen && "pointer-events-none"
          )}
          style={{
            width: sidebarWidth,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            marginLeft: sidebarOpen ? 0 : -sidebarWidth,
          }}
          aria-hidden={!sidebarOpen}
          onKeyDown={handleSidebarKeyDown}
          {...(!sidebarOpen && { inert: true })}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-4">
              {sidebar}
            </div>
          </div>

          {/* Resize handle */}
          {sidebarOpen && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors"
              onMouseDown={handleMouseDown}
            />
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
