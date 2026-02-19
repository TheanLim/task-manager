import type { DomainEvent } from './types';

/**
 * Domain event listener callback type
 */
type DomainEventListener = (event: DomainEvent) => void;

/**
 * Set of registered domain event listeners
 */
const listeners: Set<DomainEventListener> = new Set();

/**
 * Subscribe to domain events
 *
 * @param listener - Callback function to invoke when domain events are emitted
 * @returns Unsubscribe function to remove the listener
 */
export function subscribeToDomainEvents(listener: DomainEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Emit a domain event to all registered listeners
 *
 * @param event - The domain event to emit
 */
export function emitDomainEvent(event: DomainEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

/**
 * Remove all registered domain event listeners
 * Used primarily for testing cleanup
 */
export function unsubscribeAll(): void {
  listeners.clear();
}
