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
