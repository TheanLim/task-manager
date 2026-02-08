'use client';

import { useState, useEffect, useRef } from 'react';
import { ValidationError } from '@/lib/validation';

interface InlineEditableProps {
  value: string;
  onSave: (newValue: string) => void;
  validate?: (value: string) => void;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  displayElement?: React.ReactNode;
}

export function InlineEditable({
  value,
  onSave,
  validate,
  placeholder = 'Click to edit',
  className = '',
  displayClassName = '',
  inputClassName = '',
  displayElement,
}: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();

    // Validate
    if (validate) {
      try {
        validate(trimmedValue);
      } catch (err) {
        if (err instanceof ValidationError) {
          setError(err.message);
          return;
        }
        throw err;
      }
    }

    // Save if changed
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }

    setIsEditing(false);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`
            w-full max-w-full rounded-md border-2 px-2 py-1
            bg-background text-foreground
            border-primary
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
            placeholder:text-muted-foreground
            transition-colors
            ${error ? 'border-destructive focus:ring-destructive' : ''}
            ${inputClassName}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'inline-edit-error' : undefined}
        />
        {error && (
          <span
            id="inline-edit-error"
            className="text-destructive text-sm block mt-1"
            role="alert"
          >
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`
        inline-block cursor-text rounded px-1 -mx-1
        max-w-full truncate
        transition-colors duration-150
        hover:bg-accent/50 hover:text-accent-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${displayClassName}
        ${className}
      `}
      title="Click to edit"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value ? (
        value
      ) : displayElement ? (
        displayElement
      ) : (
        <span className="text-muted-foreground italic">{placeholder}</span>
      )}
    </span>
  );
}
