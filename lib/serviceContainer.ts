/**
 * ServiceContainer centralizes repository and service instantiation.
 * Extracted from stores/dataStore.ts to separate wiring from store definition.
 */
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageProjectRepository,
  LocalStorageTaskRepository,
  LocalStorageSectionRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import { TaskService } from '@/features/tasks/services/taskService';
import { ProjectService } from '@/features/projects/services/projectService';
import { SectionService } from '@/features/projects/services/sectionService';
import { DependencyService } from '@/features/tasks/services/dependencyService';
import { DependencyResolverImpl } from '@/features/tasks/services/dependencyResolver';
import { LocalStorageAutomationRuleRepository } from '@/features/automations/repositories/localStorageAutomationRuleRepository';
import { RuleExecutor } from '@/features/automations/services/ruleExecutor';
import { AutomationService } from '@/features/automations/services/automationService';
import { emitDomainEvent } from '@/lib/events';

// --- Backend ---
export const localStorageBackend = new LocalStorageBackend();

// --- Repositories ---
export const projectRepository = new LocalStorageProjectRepository(localStorageBackend);
export const taskRepository = new LocalStorageTaskRepository(localStorageBackend);
export const sectionRepository = new LocalStorageSectionRepository(localStorageBackend);
export const dependencyRepository = new LocalStorageDependencyRepository(localStorageBackend);
export const automationRuleRepository = new LocalStorageAutomationRuleRepository();

// --- Services ---
const dependencyResolver = new DependencyResolverImpl();
export const taskService = new TaskService(taskRepository, dependencyRepository, emitDomainEvent);
export const projectService = new ProjectService(
  projectRepository,
  sectionRepository,
  taskService,
  taskRepository,
  automationRuleRepository,
);
export const sectionService = new SectionService(sectionRepository, taskRepository, automationRuleRepository);
export const dependencyService = new DependencyService(dependencyRepository, dependencyResolver);

// --- Automation services ---
const ruleExecutor = new RuleExecutor(
  taskRepository,
  sectionRepository,
  taskService,
  automationRuleRepository,
);

export const automationService = new AutomationService(
  automationRuleRepository,
  taskRepository,
  sectionRepository,
  taskService,
  ruleExecutor,
);

// --- Scheduler services (scheduled triggers) ---
import { SystemClock } from '@/features/automations/services/clock';
import { SchedulerService } from '@/features/automations/services/schedulerService';
import { SchedulerLeaderElection } from '@/features/automations/services/schedulerLeaderElection';
import type { AutomationRule } from '@/features/automations/types';
import type { ScheduleEvaluation } from '@/features/automations/services/scheduleEvaluator';

const schedulerClock = new SystemClock();

/**
 * Callback: routes scheduled rule firings into AutomationService.
 * Creates a schedule.fired domain event and feeds it through handleEvent.
 */
function onScheduledRuleFired({ rule, evaluation }: { rule: AutomationRule; evaluation: ScheduleEvaluation }): void {
  if (evaluation.matchingTaskIds && evaluation.matchingTaskIds.length > 0) {
    // Due-date-relative: one event per matching task
    for (const taskId of evaluation.matchingTaskIds) {
      const event = {
        type: 'schedule.fired' as const,
        entityId: taskId,
        projectId: rule.projectId,
        changes: { triggerType: rule.trigger.type },
        previousValues: {},
        triggeredByRule: rule.id,
        depth: 0,
      };
      automationService.handleEvent(event);
    }
  } else {
    // Interval/cron: single event with rule ID as entityId
    const event = {
      type: 'schedule.fired' as const,
      entityId: rule.id,
      projectId: rule.projectId,
      changes: { triggerType: rule.trigger.type },
      previousValues: {},
      triggeredByRule: rule.id,
      depth: 0,
    };
    automationService.handleEvent(event);
  }
}

export const schedulerService = new SchedulerService(
  schedulerClock,
  automationRuleRepository,
  taskRepository,
  onScheduledRuleFired,
);

export const schedulerLeaderElection = new SchedulerLeaderElection(
  () => schedulerService.start(),
  () => schedulerService.stop(),
);
