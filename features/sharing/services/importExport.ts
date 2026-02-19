import { AppState } from '@/types';
import { AppStateSchema } from '@/lib/schemas';

/**
 * Custom error for import operations
 */
export class ImportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Validate that an unknown value is a valid AppState using Zod schema.
 */
export function validateAppState(state: unknown): state is AppState {
  const result = AppStateSchema.safeParse(state);
  if (!result.success) {
    console.error('Validation failed:', result.error.format());
    return false;
  }
  return true;
}

/**
 * Parse and validate a JSON string as AppState.
 * Throws ImportError if JSON is invalid or state structure is invalid.
 */
export function importFromJSON(json: string): AppState {
  try {
    const parsed = JSON.parse(json);

    const result = AppStateSchema.safeParse(parsed);
    if (!result.success) {
      throw new ImportError(
        `Invalid import data: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }

    return result.data as unknown as AppState;
  } catch (error) {
    if (error instanceof ImportError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ImportError('Invalid JSON format', error);
    }
    throw new ImportError('Failed to import data', error);
  }
}
