"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ScopePillProps = {
  scope: "all" | "selected" | "all_except"
  selectedProjectIds: string[]
  excludedProjectIds: string[]
  allProjects: Array<{ id: string; name: string }>
}

function getScopeColorScheme(scope: "all" | "selected" | "all_except") {
  switch (scope) {
    case "all":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
    case "selected":
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
    case "all_except":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800"
  }
}

function getScopeLabel(scope: "all" | "selected" | "all_except") {
  switch (scope) {
    case "all":
      return "All Projects"
    case "selected":
      return "Selected"
    case "all_except":
      return "All except"
  }
}

function getAriaLabel(
  scope: "all" | "selected" | "all_except",
  projectNames: string[]
) {
  const base = getScopeLabel(scope)
  const context =
    scope === "all_except"
      ? `Excluded: ${projectNames.join(", ")}`
      : `Applies to: ${projectNames.join(", ")}`
  return `Scope: ${base}. ${context}`
}

export function ScopePill({
  scope,
  selectedProjectIds,
  excludedProjectIds,
  allProjects,
}: ScopePillProps) {
  const projectMap = React.useMemo(
    () =>
      new Map(allProjects.map((p) => [p.id, p.name])),
    [allProjects]
  )

  const projectNames =
    scope === "all"
      ? []
      : scope === "selected"
      ? selectedProjectIds.map((id) => projectMap.get(id) ?? id)
      : excludedProjectIds.map((id) => projectMap.get(id) ?? id)

  const shouldTruncate = projectNames.length > 10
  const displayedNames = shouldTruncate
    ? projectNames.slice(0, 10)
    : projectNames
  const remainingCount = shouldTruncate
    ? projectNames.length - 10
    : 0

  const projectListText = displayedNames.join(", ")
  const fullProjectList = shouldTruncate
    ? `${projectListText} +${remainingCount} more`
    : projectNames.join(", ")

  const ariaLabel = getAriaLabel(scope, projectNames)

  const colorScheme = getScopeColorScheme(scope)

  if (scope === "all") {
    return (
      <Badge variant="outline" className={cn("cursor-default", colorScheme)}>
        All Projects
      </Badge>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-default",
              colorScheme
            )}
            aria-label={ariaLabel}
          >
            {scope === "selected"
              ? `${projectNames.length} projects`
              : `All except ${projectNames.length}`}
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="max-w-xs"
          sideOffset={8}
        >
          <div className="max-h-32 overflow-y-auto">
            {fullProjectList}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ScopePill
