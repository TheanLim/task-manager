import { describe, it, expect } from 'vitest';
import {
  localStorageBackend,
  projectRepository,
  taskRepository,
  sectionRepository,
  dependencyRepository,
  automationRuleRepository,
  taskService,
  projectService,
  sectionService,
  dependencyService,
  automationService,
} from './serviceContainer';

describe('serviceContainer', () => {
  it('exports all repository singletons', () => {
    expect(localStorageBackend).toBeDefined();
    expect(projectRepository).toBeDefined();
    expect(taskRepository).toBeDefined();
    expect(sectionRepository).toBeDefined();
    expect(dependencyRepository).toBeDefined();
    expect(automationRuleRepository).toBeDefined();
  });

  it('exports all service singletons', () => {
    expect(taskService).toBeDefined();
    expect(projectService).toBeDefined();
    expect(sectionService).toBeDefined();
    expect(dependencyService).toBeDefined();
    expect(automationService).toBeDefined();
  });

  it('repositories have expected interface methods', () => {
    expect(typeof projectRepository.findById).toBe('function');
    expect(typeof projectRepository.findAll).toBe('function');
    expect(typeof projectRepository.create).toBe('function');
    expect(typeof projectRepository.update).toBe('function');
    expect(typeof projectRepository.delete).toBe('function');
    expect(typeof projectRepository.subscribe).toBe('function');
  });

  it('services have expected methods', () => {
    expect(typeof taskService.cascadeDelete).toBe('function');
    expect(typeof taskService.cascadeComplete).toBe('function');
    expect(typeof taskService.reinsertTask).toBe('function');
    expect(typeof projectService.createWithDefaults).toBe('function');
    expect(typeof projectService.cascadeDelete).toBe('function');
    expect(typeof sectionService.cascadeDelete).toBe('function');
    expect(typeof dependencyService.addDependency).toBe('function');
    expect(typeof automationService.handleEvent).toBe('function');
  });
});
