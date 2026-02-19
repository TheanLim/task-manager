'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { useCrossTabSync } from '@/app/hooks/useCrossTabSync';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  searchInput?: React.ReactNode;
}

/** Mobile sidebar drawer with body scroll lock */
function MobileSidebarDrawer({
  sidebarRef,
  onClose,
  onKeyDown,
  onContentClick,
  sidebar,
}: {
  sidebarRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onContentClick: () => void;
  sidebar: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <aside
        ref={sidebarRef as React.RefObject<HTMLElement>}
        className="relative z-50 w-64 max-w-[80vw] bg-card h-full overflow-y-auto shadow-lg"
        onKeyDown={onKeyDown}
      >
        <div className="flex h-full flex-col">
          <div
            className="flex-1 overflow-y-auto p-4"
            onClick={onContentClick}
          >
            {sidebar}
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * Main layout component with responsive sidebar.
 * On mobile (< lg), the sidebar renders as a fixed overlay drawer with backdrop.
 */
export function Layout({ children, sidebar, header, breadcrumb, searchInput }: LayoutProps) {
  useCrossTabSync();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prevSidebarOpen = useRef(sidebarOpen);

  const minWidth = 200;
  const maxWidth = 600;

  // Close mobile drawer on navigation (listen for click on links/buttons inside sidebar)
  const closeMobileSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sidebarOpen || isMobile) return;
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

  // Escape key in sidebar: return focus to toggle button (and close on mobile)
  const handleSidebarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (isMobile) setSidebarOpen(false);
      toggleRef.current?.focus();
    }
  };

  // Mobile sidebar: rendered as a fixed overlay drawer
  const renderMobileSidebar = () => {
    if (!isMobile || !sidebarOpen) return null;
    return (
      <MobileSidebarDrawer
        sidebarRef={sidebarRef}
        onClose={() => setSidebarOpen(false)}
        onKeyDown={handleSidebarKeyDown}
        onContentClick={closeMobileSidebar}
        sidebar={sidebar}
      />
    );
  };

  // Desktop sidebar: original sliding panel with resize handle
  const renderDesktopSidebar = () => {
    if (isMobile) return null;
    return (
      <aside
        ref={sidebarRef}
        className={cn(
          "relative bg-card flex-shrink-0 overflow-hidden dark:border-r dark:border-white/5",
          sidebarOpen
            ? "transition-[transform,margin] duration-200 ease-out"
            : "pointer-events-none transition-[transform,margin,visibility] duration-200 ease-out invisible"
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
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header - always visible at top */}
      <header className="flex h-14 items-center gap-3 shadow-elevation-base bg-card px-4 flex-shrink-0">
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

        {/* App wordmark */}
        <span className="text-accent-brand font-bold text-sm tracking-tight">Tasks</span>

        {(breadcrumb || header) && (
          <>
            <Separator orientation="vertical" className="h-5" />
            {breadcrumb}
            <div className="flex flex-1 items-center justify-between">
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {searchInput}
                {header}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Content area below header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar drawer */}
        {renderMobileSidebar()}

        {/* Desktop sidebar */}
        {renderDesktopSidebar()}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
