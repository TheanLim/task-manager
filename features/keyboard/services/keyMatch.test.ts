import { describe, it, expect } from 'vitest';
import { matchesKey } from './keyMatch';

const noMods = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
const ctrl = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
const meta = { ctrlKey: false, metaKey: true, shiftKey: false, altKey: false };
const shift = { ctrlKey: false, metaKey: false, shiftKey: true, altKey: false };

describe('matchesKey', () => {
  // Simple keys
  it('matches "Space" against space key', () => {
    expect(matchesKey({ key: ' ', ...noMods }, 'Space')).toBe(true);
  });

  it('matches "Enter" against Enter key', () => {
    expect(matchesKey({ key: 'Enter', ...noMods }, 'Enter')).toBe(true);
  });

  it('matches "Escape" against Escape key', () => {
    expect(matchesKey({ key: 'Escape', ...noMods }, 'Escape')).toBe(true);
  });

  it('matches single letter "e"', () => {
    expect(matchesKey({ key: 'e', ...noMods }, 'e')).toBe(true);
  });

  it('does not match wrong key', () => {
    expect(matchesKey({ key: 'x', ...noMods }, 'e')).toBe(false);
  });

  // Modifier combos
  it('matches "Ctrl+Enter" with ctrlKey', () => {
    expect(matchesKey({ key: 'Enter', ...ctrl }, 'Ctrl+Enter')).toBe(true);
  });

  it('matches "Ctrl+Enter" with metaKey (Mac Cmd)', () => {
    expect(matchesKey({ key: 'Enter', ...meta }, 'Ctrl+Enter')).toBe(true);
  });

  it('does not match "Ctrl+Enter" without modifier', () => {
    expect(matchesKey({ key: 'Enter', ...noMods }, 'Ctrl+Enter')).toBe(false);
  });

  it('matches "Ctrl+k" with ctrlKey', () => {
    expect(matchesKey({ key: 'k', ...ctrl }, 'Ctrl+k')).toBe(true);
  });

  // Modifier required — no false positives
  it('does not match "Space" when ctrl is held', () => {
    expect(matchesKey({ key: ' ', ...ctrl }, 'Space')).toBe(false);
  });

  it('does not match "e" when ctrl is held', () => {
    expect(matchesKey({ key: 'e', ...ctrl }, 'e')).toBe(false);
  });

  // Shift handling for special chars
  it('matches "/" stored key against "/" event key', () => {
    expect(matchesKey({ key: '/', ...noMods }, '/')).toBe(true);
  });

  it('matches "?" stored key against "?" event key (shift+/)', () => {
    expect(matchesKey({ key: '?', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, '?')).toBe(true);
  });

  // Alt modifier
  it('matches "Alt+k"', () => {
    expect(matchesKey({ key: 'k', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }, 'Alt+k')).toBe(true);
  });

  it('does not match "Alt+k" without alt', () => {
    expect(matchesKey({ key: 'k', ...noMods }, 'Alt+k')).toBe(false);
  });
});
