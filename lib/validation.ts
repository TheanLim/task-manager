/**
 * Validation utilities for the task management application.
 * Provides validation functions for user input and data integrity.
 */

/**
 * Custom error class for validation failures.
 * Provides structured error information including the field name and invalid value.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Validates a project name.
 * 
 * Rules:
 * - Must not be empty or only whitespace
 * - Must not exceed 200 characters
 * 
 * @param name - The project name to validate
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * validateProjectName("My Project"); // OK
 * validateProjectName(""); // Throws ValidationError
 * validateProjectName("   "); // Throws ValidationError
 * validateProjectName("a".repeat(201)); // Throws ValidationError
 */
export function validateProjectName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError(
      'Project name cannot be empty',
      'name',
      name
    );
  }

  if (name.length > 200) {
    throw new ValidationError(
      'Project name cannot exceed 200 characters',
      'name',
      name
    );
  }
}

/**
 * Validates a task description.
 * 
 * Rules:
 * - Must not be empty or only whitespace
 * - Must not exceed 500 characters
 * 
 * @param description - The task description to validate
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * validateTaskDescription("Complete the report"); // OK
 * validateTaskDescription(""); // Throws ValidationError
 * validateTaskDescription("   "); // Throws ValidationError
 * validateTaskDescription("a".repeat(501)); // Throws ValidationError
 */
export function validateTaskDescription(description: string): void {
  if (!description || description.trim().length === 0) {
    throw new ValidationError(
      'Task description cannot be empty',
      'description',
      description
    );
  }

  if (description.length > 500) {
    throw new ValidationError(
      'Task description cannot exceed 500 characters',
      'description',
      description
    );
  }
}

/**
 * Validates a section name.
 * 
 * Rules:
 * - Must not be empty or only whitespace
 * - Must not exceed 100 characters
 * 
 * @param name - The section name to validate
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * validateSectionName("In Progress"); // OK
 * validateSectionName(""); // Throws ValidationError
 * validateSectionName("   "); // Throws ValidationError
 * validateSectionName("a".repeat(101)); // Throws ValidationError
 */
export function validateSectionName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError(
      'Section name cannot be empty',
      'name',
      name
    );
  }

  if (name.length > 100) {
    throw new ValidationError(
      'Section name cannot exceed 100 characters',
      'name',
      name
    );
  }
}

/**
 * Validates a column name.
 * 
 * Rules:
 * - Must not be empty or only whitespace
 * - Must not exceed 100 characters
 * 
 * @param name - The column name to validate
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * validateColumnName("To Do"); // OK
 * validateColumnName(""); // Throws ValidationError
 * validateColumnName("   "); // Throws ValidationError
 * validateColumnName("a".repeat(101)); // Throws ValidationError
 */
export function validateColumnName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError(
      'Column name cannot be empty',
      'name',
      name
    );
  }

  if (name.length > 100) {
    throw new ValidationError(
      'Column name cannot exceed 100 characters',
      'name',
      name
    );
  }
}
