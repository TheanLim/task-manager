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
  const editRef = useRef<HTMLSpanElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedValue = (editRef.current?.textContent || '').trim();

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
      <span className={`inline-flex flex-col ${className}`}>
        <span
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`
            inline-block min-w-[50px] rounded border px-1 -mx-1 outline-none
            bg-background text-foreground whitespace-nowrap
            border-gray-400 dark:border-gray-500
            ${error ? 'border-destructive' : ''}
            ${displayClassName}
            ${inputClassName}
          `}
          role="textbox"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'inline-edit-error' : undefined}
        >
          {editValue}
        </span>
        {error && (
          <span
            id="inline-edit-error"
            className="text-destructive text-sm block mt-1"
            role="alert"
          >
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`
        ${value ? 'inline-flex' : 'flex'} items-center cursor-text rounded px-1 -mx-1
        transition-all duration-150
        hover:bg-accent/50 hover:text-accent-foreground hover:border hover:border-gray-400 dark:hover:border-gray-500
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
