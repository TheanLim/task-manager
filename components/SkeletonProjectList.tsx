/**
 * Skeleton placeholder for the sidebar project list, shown during SSR hydration.
 * Renders 5 pulsing rows mimicking project items (color dot + text bar + count pill).
 */
export function SkeletonProjectList() {
  return (
    <div className="space-y-1" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
          {/* Color dot */}
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          {/* Project name bar */}
          <div
            className="h-4 rounded bg-muted animate-pulse"
            style={{ width: `${60 + ((i * 17) % 30)}%` }}
          />
          {/* Count pill */}
          <div className="ml-auto h-5 w-8 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}
