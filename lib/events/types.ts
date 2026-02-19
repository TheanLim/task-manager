/**
 * Domain event emitted by the service layer after a mutation occurs.
 * Cross-cutting concern — consumed by automations, potentially by analytics, logging, etc.
 */
export interface DomainEvent {
  /** Event type: task.created, task.updated, task.deleted, section.created, or section.updated */
  type: 'task.created' | 'task.updated' | 'task.deleted' | 'section.created' | 'section.updated';
  /** ID of the affected entity */
  entityId: string;
  /** Project scope */
  projectId: string;
  /** New field values after the mutation */
  changes: Record<string, unknown>;
  /** Old field values before the mutation */
  previousValues: Record<string, unknown>;
  /** Rule ID if this event was triggered by an automation (undefined for user-initiated) */
  triggeredByRule?: string;
  /** Cascade depth (0 = user-initiated, increments with each automation-triggered event) */
  depth: number;
}
