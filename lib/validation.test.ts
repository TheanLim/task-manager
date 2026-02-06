import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateProjectName,
  validateTaskDescription,
  validateSectionName,
  validateColumnName,
} from './validation';

describe('ValidationError', () => {
  it('creates error with correct properties', () => {
    const error = new ValidationError('Test error', 'testField', 'testValue');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ValidationError');
    expect(error.field).toBe('testField');
    expect(error.value).toBe('testValue');
  });

  it('maintains stack trace', () => {
    const error = new ValidationError('Test error', 'testField', 'testValue');
    expect(error.stack).toBeDefined();
  });
});

describe('validateProjectName', () => {
  describe('valid names', () => {
    it('accepts valid project name', () => {
      expect(() => validateProjectName('My Project')).not.toThrow();
    });

    it('accepts name with 200 characters', () => {
      const name = 'a'.repeat(200);
      expect(() => validateProjectName(name)).not.toThrow();
    });

    it('accepts name with special characters', () => {
      expect(() => validateProjectName('Project #1 - Q4 2024')).not.toThrow();
    });

    it('accepts name with leading/trailing spaces', () => {
      expect(() => validateProjectName('  Project  ')).not.toThrow();
    });

    it('accepts single character name', () => {
      expect(() => validateProjectName('A')).not.toThrow();
    });
  });

  describe('invalid names', () => {
    it('rejects empty string', () => {
      expect(() => validateProjectName('')).toThrow(ValidationError);
      expect(() => validateProjectName('')).toThrow('Project name cannot be empty');
    });

    it('rejects whitespace-only string', () => {
      expect(() => validateProjectName('   ')).toThrow(ValidationError);
      expect(() => validateProjectName('   ')).toThrow('Project name cannot be empty');
    });

    it('rejects name exceeding 200 characters', () => {
      const name = 'a'.repeat(201);
      expect(() => validateProjectName(name)).toThrow(ValidationError);
      expect(() => validateProjectName(name)).toThrow('Project name cannot exceed 200 characters');
    });

    it('provides correct error details', () => {
      try {
        validateProjectName('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.field).toBe('name');
          expect(error.value).toBe('');
        }
      }
    });
  });
});

describe('validateTaskDescription', () => {
  describe('valid descriptions', () => {
    it('accepts valid task description', () => {
      expect(() => validateTaskDescription('Complete the report')).not.toThrow();
    });

    it('accepts description with 500 characters', () => {
      const description = 'a'.repeat(500);
      expect(() => validateTaskDescription(description)).not.toThrow();
    });

    it('accepts description with special characters', () => {
      expect(() => validateTaskDescription('Task #1: Review & approve')).not.toThrow();
    });

    it('accepts description with leading/trailing spaces', () => {
      expect(() => validateTaskDescription('  Task description  ')).not.toThrow();
    });

    it('accepts single character description', () => {
      expect(() => validateTaskDescription('A')).not.toThrow();
    });

    it('accepts multiline description', () => {
      expect(() => validateTaskDescription('Line 1\nLine 2\nLine 3')).not.toThrow();
    });
  });

  describe('invalid descriptions', () => {
    it('rejects empty string', () => {
      expect(() => validateTaskDescription('')).toThrow(ValidationError);
      expect(() => validateTaskDescription('')).toThrow('Task description cannot be empty');
    });

    it('rejects whitespace-only string', () => {
      expect(() => validateTaskDescription('   ')).toThrow(ValidationError);
      expect(() => validateTaskDescription('   ')).toThrow('Task description cannot be empty');
    });

    it('rejects description exceeding 500 characters', () => {
      const description = 'a'.repeat(501);
      expect(() => validateTaskDescription(description)).toThrow(ValidationError);
      expect(() => validateTaskDescription(description)).toThrow('Task description cannot exceed 500 characters');
    });

    it('provides correct error details', () => {
      try {
        validateTaskDescription('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.field).toBe('description');
          expect(error.value).toBe('');
        }
      }
    });
  });
});

describe('validateSectionName', () => {
  describe('valid names', () => {
    it('accepts valid section name', () => {
      expect(() => validateSectionName('In Progress')).not.toThrow();
    });

    it('accepts name with 100 characters', () => {
      const name = 'a'.repeat(100);
      expect(() => validateSectionName(name)).not.toThrow();
    });

    it('accepts name with special characters', () => {
      expect(() => validateSectionName('Section #1 - Active')).not.toThrow();
    });

    it('accepts name with leading/trailing spaces', () => {
      expect(() => validateSectionName('  Section  ')).not.toThrow();
    });

    it('accepts single character name', () => {
      expect(() => validateSectionName('A')).not.toThrow();
    });
  });

  describe('invalid names', () => {
    it('rejects empty string', () => {
      expect(() => validateSectionName('')).toThrow(ValidationError);
      expect(() => validateSectionName('')).toThrow('Section name cannot be empty');
    });

    it('rejects whitespace-only string', () => {
      expect(() => validateSectionName('   ')).toThrow(ValidationError);
      expect(() => validateSectionName('   ')).toThrow('Section name cannot be empty');
    });

    it('rejects name exceeding 100 characters', () => {
      const name = 'a'.repeat(101);
      expect(() => validateSectionName(name)).toThrow(ValidationError);
      expect(() => validateSectionName(name)).toThrow('Section name cannot exceed 100 characters');
    });

    it('provides correct error details', () => {
      try {
        validateSectionName('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.field).toBe('name');
          expect(error.value).toBe('');
        }
      }
    });
  });
});

describe('validateColumnName', () => {
  describe('valid names', () => {
    it('accepts valid column name', () => {
      expect(() => validateColumnName('To Do')).not.toThrow();
    });

    it('accepts name with 100 characters', () => {
      const name = 'a'.repeat(100);
      expect(() => validateColumnName(name)).not.toThrow();
    });

    it('accepts name with special characters', () => {
      expect(() => validateColumnName('Column #1 - Active')).not.toThrow();
    });

    it('accepts name with leading/trailing spaces', () => {
      expect(() => validateColumnName('  Column  ')).not.toThrow();
    });

    it('accepts single character name', () => {
      expect(() => validateColumnName('A')).not.toThrow();
    });
  });

  describe('invalid names', () => {
    it('rejects empty string', () => {
      expect(() => validateColumnName('')).toThrow(ValidationError);
      expect(() => validateColumnName('')).toThrow('Column name cannot be empty');
    });

    it('rejects whitespace-only string', () => {
      expect(() => validateColumnName('   ')).toThrow(ValidationError);
      expect(() => validateColumnName('   ')).toThrow('Column name cannot be empty');
    });

    it('rejects name exceeding 100 characters', () => {
      const name = 'a'.repeat(101);
      expect(() => validateColumnName(name)).toThrow(ValidationError);
      expect(() => validateColumnName(name)).toThrow('Column name cannot exceed 100 characters');
    });

    it('provides correct error details', () => {
      try {
        validateColumnName('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.field).toBe('name');
          expect(error.value).toBe('');
        }
      }
    });
  });
});

describe('edge cases', () => {
  it('handles tabs and newlines as whitespace', () => {
    expect(() => validateProjectName('\t\n')).toThrow('Project name cannot be empty');
    expect(() => validateTaskDescription('\t\n')).toThrow('Task description cannot be empty');
    expect(() => validateSectionName('\t\n')).toThrow('Section name cannot be empty');
    expect(() => validateColumnName('\t\n')).toThrow('Column name cannot be empty');
  });

  it('handles unicode characters', () => {
    expect(() => validateProjectName('项目名称')).not.toThrow();
    expect(() => validateTaskDescription('タスクの説明')).not.toThrow();
    expect(() => validateSectionName('Раздел')).not.toThrow();
    expect(() => validateColumnName('Colonne')).not.toThrow();
  });

  it('handles emoji characters', () => {
    expect(() => validateProjectName('Project 🚀')).not.toThrow();
    expect(() => validateTaskDescription('Task ✅')).not.toThrow();
    expect(() => validateSectionName('Section 📋')).not.toThrow();
    expect(() => validateColumnName('Column 📌')).not.toThrow();
  });
});
