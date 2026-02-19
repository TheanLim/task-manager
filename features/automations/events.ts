/**
 * Re-export domain events from the shared lib/events module.
 * Kept for backward compatibility — existing consumers can still import from here.
 * New code should import from '@/lib/events' directly.
 */
export { emitDomainEvent, subscribeToDomainEvents, unsubscribeAll } from '@/lib/events';
export type { DomainEvent } from '@/lib/events/types';
