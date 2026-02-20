import { describe, it, expect } from 'vitest';
import { isInputContext } from './inputContext';

describe('isInputContext', () => {
  it('returns false for null', () => {
    expect(isInputContext(null)).toBe(false);
  });

  it('returns true for <input>', () => {
    const el = document.createElement('input');
    expect(isInputContext(el)).toBe(true);
  });

  it('returns true for <textarea>', () => {
    const el = document.createElement('textarea');
    expect(isInputContext(el)).toBe(true);
  });

  it('returns true for contenteditable="true"', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isInputContext(el)).toBe(true);
  });

  it('returns true for nested contenteditable (via closest)', () => {
    const parent = document.createElement('div');
    parent.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(isInputContext(child)).toBe(true);
    document.body.removeChild(parent);
  });

  it('returns true for role="combobox"', () => {
    const el = document.createElement('div');
    el.setAttribute('role', 'combobox');
    expect(isInputContext(el)).toBe(true);
  });

  it('returns true for data-keyboard-trap', () => {
    const el = document.createElement('div');
    el.setAttribute('data-keyboard-trap', '');
    expect(isInputContext(el)).toBe(true);
  });

  it('returns false for a plain div', () => {
    const el = document.createElement('div');
    expect(isInputContext(el)).toBe(false);
  });
});
