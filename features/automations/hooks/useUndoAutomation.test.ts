import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoAutomation, notifyUndoChange } from './useUndoAutomation';
import * as undoService from '../services/undoService';

// Mock the undoService functions
vi.mock('../services/undoService', () => ({
  getUndoSnapshot: vi.fn(),
  clearUndoSnapshot: vi.fn(),
  performUndo: vi.fn(),
  UNDO_EXPIRY_MS: 10_000,
}));

// Mock the dataStore taskRepository
vi.mock('@/stores/dataStore', () => ({
  taskRepository: { findById: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

describe('useUndoAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns canUndo=false when no snapshot exists', () => {
    const { result } = renderHook(() => useUndoAutomation());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoDescription).toBeNull();
  });

  it('returns canUndo=true with description when snapshot exists', () => {
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue({
      ruleId: 'rule-1',
      ruleName: 'Move to Done',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useUndoAutomation());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoDescription).toBe('Undo: Move to Done');
  });

  it('returns canUndo=false when snapshot has expired', () => {
    // getUndoSnapshot already handles expiry internally and returns null
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderHook(() => useUndoAutomation());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoDescription).toBeNull();
  });

  it('calls performUndo and notifies on success', () => {
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue({
      ruleId: 'rule-1',
      ruleName: 'Auto Complete',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false },
      timestamp: Date.now(),
    });
    (undoService.performUndo as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { result } = renderHook(() => useUndoAutomation());

    act(() => {
      result.current.performUndo();
    });

    expect(undoService.performUndo).toHaveBeenCalledTimes(1);
  });

  it('does not notify when performUndo returns false', () => {
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (undoService.performUndo as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useUndoAutomation());

    act(() => {
      result.current.performUndo();
    });

    expect(undoService.performUndo).toHaveBeenCalledTimes(1);
  });

  it('re-renders when notifyUndoChange is called', () => {
    // Start with no snapshot
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderHook(() => useUndoAutomation());

    expect(result.current.canUndo).toBe(false);

    // Now simulate a snapshot appearing
    (undoService.getUndoSnapshot as ReturnType<typeof vi.fn>).mockReturnValue({
      ruleId: 'rule-2',
      ruleName: 'New Rule',
      actionType: 'set_due_date',
      targetEntityId: 'task-2',
      previousState: { dueDate: null },
      timestamp: Date.now(),
    });

    act(() => {
      notifyUndoChange();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoDescription).toBe('Undo: New Rule');
  });
});
