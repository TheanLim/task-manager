import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertTriangle, Eye } from 'lucide-react';
import { useGlobalDryRun } from '../../hooks/useGlobalDryRun';
import type { AutomationRule } from '../../types';
import type { Task, Section } from '@/lib/schemas';
import type { GlobalDryRunResult } from '../../services/preview/rulePreviewService';

interface GlobalDryRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule;
  projects: Array<{ id: string; name: string }>;
  allTasks: Task[];
  allSections: Section[];
}

interface DryRunResultRowProps {
  result: GlobalDryRunResult;
}

function DryRunResultRow({ result }: DryRunResultRowProps) {
  const { task, outcome, skipReason } = result;
  const isFire = outcome === 'fire';

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded text-sm ${
        !isFire ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isFire ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{task.description}</div>
        {isFire ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            Would fire this rule
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-0.5">
            {skipReason || 'Would skip'}
          </div>
        )}
      </div>
    </div>
  );
}

export function GlobalDryRunDialog({
  open,
  onOpenChange,
  rule,
  projects,
  allTasks,
  allSections,
}: GlobalDryRunDialogProps) {
  const { summary, isRunning, isStale, showCountWarning, run, reset } =
    useGlobalDryRun(rule, projects, allTasks, allSections);
  const [hasRun, setHasRun] = useState(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open && !hasRun) {
      run();
      setHasRun(true);
    } else if (!open) {
      reset();
      setHasRun(false);
    }
  }, [open, hasRun, run, reset]);

  const projectsWithResults = summary
    ? Object.entries(summary.projectResults)
        .filter(([, results]) => results.length > 0)
        .map(([projectId, results]) => {
          const project = projects.find((p) => p.id === projectId);
          const fireCount = results.filter((r) => r.outcome === 'fire').length;
          const skipCount = results.filter((r) => r.outcome === 'skip').length;
          const hasSkips = skipCount > 0;

          return {
            id: projectId,
            name: project?.name || `Project ${projectId}`,
            results,
            fireCount,
            skipCount,
            hasSkips,
          };
        })
    : [];

  const projectsWithSkips = projectsWithResults.filter((p) => p.hasSkips);
  const defaultExpandedProjects = projectsWithSkips.map((p) => p.id);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" aria-label="Global dry run">
        <DialogHeader>
          <DialogTitle>Global Dry Run</DialogTitle>
          <DialogDescription>
            Preview how this rule would affect tasks across all projects
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isRunning ? (
            <div className="space-y-3 py-4" aria-busy="true" aria-label="Running dry-run...">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded bg-muted animate-pulse"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : summary ? (
            <>
              {/* Summary bar */}
              <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded">
                <div className="text-sm">
                  <span className="font-medium">Scope: {projects.length} projects</span>
                  {summary.runAt && (
                    <span className="text-muted-foreground">
                      {' '}· Run at {formatTime(summary.runAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      {summary.totalFire} fire
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                      {summary.totalSkip} skip
                    </span>
                  </div>
                </div>
              </div>

              {/* Stale warning */}
              {isStale && (
                <div
                  role="alert"
                  className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 rounded"
                >
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Results may be stale. Task data may have changed.</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-auto underline-offset-2 hover:underline font-medium text-xs p-0 h-auto"
                      onClick={run}
                    >
                      Re-run
                    </Button>
                  </div>
                </div>
              )}

              {/* Project results */}
              {projectsWithResults.length > 0 ? (
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {projectsWithResults.map((project) => (
                      <div
                        key={project.id}
                        className="border rounded overflow-hidden"
                        data-state={
                          defaultExpandedProjects.includes(project.id)
                            ? 'open'
                            : 'closed'
                        }
                      >
                        <div
                          className={`flex items-center justify-between p-3 cursor-pointer ${
                            project.hasSkips
                              ? 'text-amber-700 dark:text-amber-300'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {project.fireCount > 0 && (
                              <Badge
                                variant="outline"
                                className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              >
                                {project.fireCount} fire
                              </Badge>
                            )}
                            {project.skipCount > 0 && (
                              <Badge
                                variant="outline"
                                className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              >
                                {project.skipCount} skip
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="border-t">
                          <div className="p-2 space-y-1">
                            {project.results.map((result, index) => (
                              <DryRunResultRow key={index} result={result} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div className="text-muted-foreground">
                    <p className="font-medium">No tasks would be affected</p>
                    <p className="text-sm mt-1">
                      This rule doesn't match any tasks in the selected projects.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : showCountWarning ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Large scope detected</p>
                <p className="text-sm mt-1">
                  This rule would evaluate over 500 tasks. Running a dry-run may
                  impact performance.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={run}
                >
                  Run anyway
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}