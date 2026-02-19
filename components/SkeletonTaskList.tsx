/**
 * Skeleton placeholder for the main task list, shown during SSR hydration.
 * Renders 8 pulsing rows mimicking task rows (checkbox + text bar + badge shapes).
 */
export function SkeletonTaskList() {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          {/* Checkbox */}
          <div className="w-4 h-4 rounded border border-muted bg-muted animate-pulse flex-shrink-0" />
          {/* Task description bar */}
          <div
            className="h-4 rounded bg-muted animate-pulse"
            style={{ width: `${40 + ((i * 13) % 45)}%` }}
          />
          {/* Priority / tag badge */}
          <div className="ml-auto flex items-center gap-2">
            <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
            {i % 3 === 0 && (
              <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
