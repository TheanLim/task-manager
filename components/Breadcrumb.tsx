'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/stores/dataStore';
import { useHydrated } from '@/app/hooks/useHydrated';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function useBreadcrumbItems(): BreadcrumbItem[] {
  const searchParams = useSearchParams();
  const getProjectById = useDataStore((s) => s.getProjectById);

  const projectId = searchParams.get('project');
  const view = searchParams.get('view');
  const tab = searchParams.get('tab');

  const items: BreadcrumbItem[] = [];

  if (view === 'tasks') {
    items.push({ label: 'All Tasks' });
    return items;
  }

  if (projectId) {
    const project = getProjectById(projectId);
    items.push({ label: project?.name ?? 'Unknown Project', href: `/?project=${projectId}` });

    if (tab) {
      const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
      items.push({ label: tabLabel });
    }
  }

  return items;
}

export function Breadcrumb() {
  const hydrated = useHydrated();
  const items = useBreadcrumbItems();

  // Defer rendering until client hydration so the Zustand store has loaded
  // from localStorage — avoids "Unknown Project" vs real name mismatch.
  if (!hydrated || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
            {item.href && index < items.length - 1 ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground truncate max-w-[200px]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
