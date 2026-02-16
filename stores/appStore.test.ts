import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './appStore';
import { TimeManagementSystem } from '@/types';
import type { ShortcutBinding } from '@/features/keyboard/types';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setActiveProject(null);
      result.current.setTimeManagementSystem(TimeManagementSystem.NONE);
      result.current.setShowOnlyActionableTasks(false);
      result.current.setTheme('system');
      result.current.resetKeyboardShortcuts();
    });
  });

  describe('Initial State', () => {
    it('should have default settings', () => {
      const { result } = renderHook(() => useAppStore());
      
      expect(result.current.settings).toEqual({
        activeProjectId: null,
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'system'
      });
    });
  });

  describe('setActiveProject', () => {
    it('should set active project ID', () => {
      const { result } = renderHook(() => useAppStore());
      const projectId = 'test-project-id';
      
      act(() => {
        result.current.setActiveProject(projectId);
      });
      
      expect(result.current.settings.activeProjectId).toBe(projectId);
    });

    it('should set active project to null', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setActiveProject('some-id');
      });
      
      expect(result.current.settings.activeProjectId).toBe('some-id');
      
      act(() => {
        result.current.setActiveProject(null);
      });
      
      expect(result.current.settings.activeProjectId).toBeNull();
    });
  });

  describe('setTimeManagementSystem', () => {
    it('should set time management system to DIT', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTimeManagementSystem(TimeManagementSystem.DIT);
      });
      
      expect(result.current.settings.timeManagementSystem).toBe(TimeManagementSystem.DIT);
    });

    it('should set time management system to AF4', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTimeManagementSystem(TimeManagementSystem.AF4);
      });
      
      expect(result.current.settings.timeManagementSystem).toBe(TimeManagementSystem.AF4);
    });

    it('should set time management system to FVP', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTimeManagementSystem(TimeManagementSystem.FVP);
      });
      
      expect(result.current.settings.timeManagementSystem).toBe(TimeManagementSystem.FVP);
    });

    it('should set time management system to NONE', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTimeManagementSystem(TimeManagementSystem.DIT);
      });
      
      act(() => {
        result.current.setTimeManagementSystem(TimeManagementSystem.NONE);
      });
      
      expect(result.current.settings.timeManagementSystem).toBe(TimeManagementSystem.NONE);
    });
  });

  describe('setShowOnlyActionableTasks', () => {
    it('should set show only actionable tasks to true', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setShowOnlyActionableTasks(true);
      });
      
      expect(result.current.settings.showOnlyActionableTasks).toBe(true);
    });

    it('should set show only actionable tasks to false', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setShowOnlyActionableTasks(true);
      });
      
      act(() => {
        result.current.setShowOnlyActionableTasks(false);
      });
      
      expect(result.current.settings.showOnlyActionableTasks).toBe(false);
    });

    it('should toggle show only actionable tasks', () => {
      const { result } = renderHook(() => useAppStore());
      
      expect(result.current.settings.showOnlyActionableTasks).toBe(false);
      
      act(() => {
        result.current.setShowOnlyActionableTasks(true);
      });
      
      expect(result.current.settings.showOnlyActionableTasks).toBe(true);
      
      act(() => {
        result.current.setShowOnlyActionableTasks(false);
      });
      
      expect(result.current.settings.showOnlyActionableTasks).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTheme('light');
      });
      
      expect(result.current.settings.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTheme('dark');
      });
      
      expect(result.current.settings.theme).toBe('dark');
    });

    it('should set theme to system', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTheme('light');
      });
      
      act(() => {
        result.current.setTheme('system');
      });
      
      expect(result.current.settings.theme).toBe('system');
    });
  });

  describe('Settings Persistence', () => {
    it('should preserve other settings when updating one setting', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setActiveProject('project-1');
        result.current.setTimeManagementSystem(TimeManagementSystem.DIT);
        result.current.setShowOnlyActionableTasks(true);
        result.current.setTheme('dark');
      });
      
      expect(result.current.settings).toEqual({
        activeProjectId: 'project-1',
        timeManagementSystem: TimeManagementSystem.DIT,
        showOnlyActionableTasks: true,
        theme: 'dark'
      });
      
      act(() => {
        result.current.setTheme('light');
      });
      
      expect(result.current.settings).toEqual({
        activeProjectId: 'project-1',
        timeManagementSystem: TimeManagementSystem.DIT,
        showOnlyActionableTasks: true,
        theme: 'light'
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should have empty keyboardShortcuts by default', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.keyboardShortcuts).toEqual({});
    });

    it('should set a keyboard shortcut override', () => {
      const { result } = renderHook(() => useAppStore());
      const binding: ShortcutBinding = {
        key: 't',
        label: 'New task',
        category: 'Global',
        description: 'Create a new task',
      };

      act(() => {
        // First populate the full binding, then override the key
        result.current.setKeyboardShortcut('global.newTask', 't');
      });

      expect(result.current.keyboardShortcuts['global.newTask']).toBeDefined();
      expect(result.current.keyboardShortcuts['global.newTask']?.key).toBe('t');
    });

    it('should set multiple shortcut overrides independently', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setKeyboardShortcut('global.newTask', 't');
      });
      act(() => {
        result.current.setKeyboardShortcut('global.search', 'f');
      });

      expect(result.current.keyboardShortcuts['global.newTask']?.key).toBe('t');
      expect(result.current.keyboardShortcuts['global.search']?.key).toBe('f');
    });

    it('should reset all keyboard shortcuts to empty', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setKeyboardShortcut('global.newTask', 't');
        result.current.setKeyboardShortcut('task.edit', 'i');
      });

      expect(Object.keys(result.current.keyboardShortcuts).length).toBe(2);

      act(() => {
        result.current.resetKeyboardShortcuts();
      });

      expect(result.current.keyboardShortcuts).toEqual({});
    });

    it('should overwrite an existing shortcut override', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setKeyboardShortcut('global.newTask', 't');
      });
      expect(result.current.keyboardShortcuts['global.newTask']?.key).toBe('t');

      act(() => {
        result.current.setKeyboardShortcut('global.newTask', 'c');
      });
      expect(result.current.keyboardShortcuts['global.newTask']?.key).toBe('c');
    });
  });
});
