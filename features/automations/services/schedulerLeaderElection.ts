/**
 * BroadcastChannel-based leader election for multi-tab scheduler coordination.
 * Only the leader tab runs the SchedulerService tick loop.
 *
 * Protocol:
 * - On init: broadcast `claim` with a random tab ID
 * - 2-second claim window: if a lower ID is received, yield
 * - Leader sends `heartbeat` every 30s
 * - If no heartbeat received for 60s, re-elect
 * - On `beforeunload`: broadcast `resign`
 * - Fallback: if BroadcastChannel unavailable, assume leadership immediately
 */
export class SchedulerLeaderElection {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isLeader = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private claimTimer: ReturnType<typeof setTimeout> | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  private readonly CHANNEL_NAME = 'scheduler-leader-election';
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;
  private readonly TIMEOUT_MS = 60_000;
  private readonly CLAIM_WINDOW_MS = 2_000;

  constructor(
    private onBecomeLeader: () => void,
    private onLoseLeadership: () => void
  ) {
    this.tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.init();
  }

  private init(): void {
    try {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
    } catch {
      // BroadcastChannel unavailable — assume leadership immediately
      this.becomeLeader();
      return;
    }

    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Broadcast claim
    this.postMessage({ type: 'claim', tabId: this.tabId });

    // After claim window, if no lower ID received, become leader
    this.claimTimer = setTimeout(() => {
      if (!this.isLeader) {
        this.becomeLeader();
      }
    }, this.CLAIM_WINDOW_MS);

    // Start timeout for existing leader heartbeat
    this.resetTimeout();

    // Resign on tab close
    this.beforeUnloadHandler = () => {
      if (this.isLeader) {
        this.postMessage({ type: 'resign', tabId: this.tabId });
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  private handleMessage(data: { type: string; tabId: string }): void {
    switch (data.type) {
      case 'claim':
        if (data.tabId < this.tabId) {
          // Lower ID wins — yield
          if (this.isLeader) {
            this.loseLeadership();
          }
          if (this.claimTimer) {
            clearTimeout(this.claimTimer);
            this.claimTimer = null;
          }
        } else if (this.isLeader) {
          // We have a lower ID — reassert with heartbeat
          this.postMessage({ type: 'heartbeat', tabId: this.tabId });
        }
        this.resetTimeout();
        break;

      case 'heartbeat':
        if (data.tabId !== this.tabId) {
          if (this.isLeader && data.tabId < this.tabId) {
            this.loseLeadership();
          }
          if (this.claimTimer) {
            clearTimeout(this.claimTimer);
            this.claimTimer = null;
          }
          this.resetTimeout();
        }
        break;

      case 'resign':
        // Leader resigned — re-elect after short delay
        if (this.claimTimer) clearTimeout(this.claimTimer);
        this.claimTimer = setTimeout(() => {
          this.postMessage({ type: 'claim', tabId: this.tabId });
          this.claimTimer = setTimeout(() => {
            if (!this.isLeader) {
              this.becomeLeader();
            }
          }, this.CLAIM_WINDOW_MS);
        }, Math.random() * 500); // Small random delay to reduce collision
        break;
    }
  }

  private becomeLeader(): void {
    if (this.isLeader) return;
    this.isLeader = true;

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.postMessage({ type: 'heartbeat', tabId: this.tabId });
    }, this.HEARTBEAT_INTERVAL_MS);

    this.onBecomeLeader();
  }

  private loseLeadership(): void {
    if (!this.isLeader) return;
    this.isLeader = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.onLoseLeadership();
  }

  private resetTimeout(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      // No heartbeat received — re-elect
      if (!this.isLeader) {
        this.postMessage({ type: 'claim', tabId: this.tabId });
        this.claimTimer = setTimeout(() => {
          if (!this.isLeader) {
            this.becomeLeader();
          }
        }, this.CLAIM_WINDOW_MS);
      }
    }, this.TIMEOUT_MS);
  }

  private postMessage(data: { type: string; tabId: string }): void {
    try {
      this.channel?.postMessage(data);
    } catch {
      // Channel closed — ignore silently
    }
  }

  /** Clean up all timers and listeners. */
  destroy(): void {
    this.loseLeadership();
    if (this.claimTimer) clearTimeout(this.claimTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    this.channel?.close();
    this.channel = null;
  }

  /** Expose for testing. */
  getTabId(): string {
    return this.tabId;
  }

  /** Expose for testing. */
  getIsLeader(): boolean {
    return this.isLeader;
  }
}
