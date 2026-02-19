import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDialogManager } from './useDialogManager';

describe('useDialogManager – toast queue', () => {
  it('queues multiple toasts and shows the first one', () => {
    const { result } = renderHook(() => useDialogManager());

    act(() => {
      result.current.showToast('Toast A', 'success');
      result.current.showToast('Toast B', 'error');
    });

    expect(result.current.loadingToast).not.toBeNull();
    expect(result.current.loadingToast!.message).toBe('Toast A');
    expect(result.current.loadingToast!.type).toBe('success');
  });

  it('dismissToast advances the queue to the next toast', () => {
    const { result } = renderHook(() => useDialogManager());

    act(() => {
      result.current.showToast('First', 'info');
      result.current.showToast('Second', 'error');
    });

    act(() => {
      result.current.dismissToast();
    });

    expect(result.current.loadingToast).not.toBeNull();
    expect(result.current.loadingToast!.message).toBe('Second');
    expect(result.current.loadingToast!.type).toBe('error');
  });

  it('dismissToast on empty queue is safe', () => {
    const { result } = renderHook(() => useDialogManager());

    expect(result.current.loadingToast).toBeNull();

    act(() => {
      result.current.dismissToast();
    });

    expect(result.current.loadingToast).toBeNull();
  });

  it('showToast preserves the action prop', () => {
    const { result } = renderHook(() => useDialogManager());
    const onClick = () => {};

    act(() => {
      result.current.showToast('Undo?', 'info', undefined, {
        label: 'Undo',
        onClick,
      });
    });

    expect(result.current.loadingToast).not.toBeNull();
    expect(result.current.loadingToast!.action).toEqual({
      label: 'Undo',
      onClick,
    });
  });

  it('multiple toasts with different durations are served in order', () => {
    const { result } = renderHook(() => useDialogManager());

    act(() => {
      result.current.showToast('Short', 'success', 5000);
      result.current.showToast('Long', 'info', 10000);
    });

    // First in queue
    expect(result.current.loadingToast!.message).toBe('Short');
    expect(result.current.loadingToast!.duration).toBe(5000);

    act(() => {
      result.current.dismissToast();
    });

    // Second in queue
    expect(result.current.loadingToast!.message).toBe('Long');
    expect(result.current.loadingToast!.duration).toBe(10000);

    act(() => {
      result.current.dismissToast();
    });

    // Queue drained
    expect(result.current.loadingToast).toBeNull();
  });
});
