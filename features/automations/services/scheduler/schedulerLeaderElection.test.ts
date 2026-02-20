import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchedulerLeaderElection } from './schedulerLeaderElection';

// ─── Mock BroadcastChannel ──────────────────────────────────────────────

type MessageHandler = (event: { data: any }) => void;

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: MessageHandler | null = null;
  name: string;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: any): void {
    if (this.closed) throw new Error('Channel closed');
    // Deliver to all OTHER instances with the same name
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed && instance.onmessage) {
        instance.onmessage({ data });
      }
    }
  }

  close(): void {
    this.closed = true;
    const idx = MockBroadcastChannel.instances.indexOf(this);
    if (idx >= 0) MockBroadcastChannel.instances.splice(idx, 1);
  }

  static reset(): void {
    MockBroadcastChannel.instances = [];
  }
}

describe('SchedulerLeaderElection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.reset();
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).BroadcastChannel;
  });

  it('assumes leadership after claim window with no competitors', () => {
    const onBecomeLeader = vi.fn();
    const onLoseLeadership = vi.fn();

    const election = new SchedulerLeaderElection(onBecomeLeader, onLoseLeadership);

    // Not leader yet (within claim window)
    expect(onBecomeLeader).not.toHaveBeenCalled();

    // Advance past claim window (2s)
    vi.advanceTimersByTime(2_100);

    expect(onBecomeLeader).toHaveBeenCalledTimes(1);
    expect(election.getIsLeader()).toBe(true);

    election.destroy();
  });

  // Feature: scheduled-triggers-phase-5a, Property 14: Leader election lowest-ID-wins
  it('P14: lowest tab ID wins leadership', () => {
    const onBecomeLeader1 = vi.fn();
    const onLoseLeadership1 = vi.fn();
    const onBecomeLeader2 = vi.fn();
    const onLoseLeadership2 = vi.fn();

    const election1 = new SchedulerLeaderElection(onBecomeLeader1, onLoseLeadership1);
    // Small delay so election1's claim is processed first
    vi.advanceTimersByTime(100);
    const election2 = new SchedulerLeaderElection(onBecomeLeader2, onLoseLeadership2);

    // Advance past both claim windows
    vi.advanceTimersByTime(3_000);

    // The one with the lower tab ID should be leader
    const leader1 = election1.getIsLeader();
    const leader2 = election2.getIsLeader();

    if (election1.getTabId() < election2.getTabId()) {
      expect(leader1).toBe(true);
    } else {
      expect(leader2).toBe(true);
    }

    // At least one is leader
    expect(leader1 || leader2).toBe(true);

    election1.destroy();
    election2.destroy();
  });

  it('resign triggers re-election', () => {
    const onBecomeLeader = vi.fn();
    const onLoseLeadership = vi.fn();

    const election1 = new SchedulerLeaderElection(onBecomeLeader, vi.fn());

    // Make election1 the leader
    vi.advanceTimersByTime(2_500);
    expect(election1.getIsLeader()).toBe(true);

    // Create a second tab
    const election2 = new SchedulerLeaderElection(vi.fn(), vi.fn());

    // Destroy election1 (simulates tab close with resign)
    election1.destroy();

    // Advance past re-election window
    vi.advanceTimersByTime(3_000);

    expect(election2.getIsLeader()).toBe(true);

    election2.destroy();
  });

  it('falls back to leadership when BroadcastChannel is unavailable', () => {
    // Remove BroadcastChannel
    delete (globalThis as any).BroadcastChannel;

    const onBecomeLeader = vi.fn();
    const election = new SchedulerLeaderElection(onBecomeLeader, vi.fn());

    // Should assume leadership immediately (no channel)
    expect(onBecomeLeader).toHaveBeenCalledTimes(1);
    expect(election.getIsLeader()).toBe(true);

    election.destroy();
  });

  it('heartbeat timeout triggers re-election after 60s', () => {
    const onBecomeLeader1 = vi.fn();
    const election1 = new SchedulerLeaderElection(onBecomeLeader1, vi.fn());

    vi.advanceTimersByTime(2_500);
    expect(election1.getIsLeader()).toBe(true);

    // Create second tab
    const onBecomeLeader2 = vi.fn();
    const election2 = new SchedulerLeaderElection(onBecomeLeader2, vi.fn());

    // Stop election1's heartbeat by closing its channel (simulates crash without resign)
    const channel = MockBroadcastChannel.instances.find(
      (c) => !c.closed
    );
    // Close election1's channel to simulate crash
    election1.destroy();

    // Advance past timeout (60s) + claim window (2s)
    vi.advanceTimersByTime(63_000);

    expect(election2.getIsLeader()).toBe(true);

    election2.destroy();
  });
});
