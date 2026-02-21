import { describe, it, expect } from 'vitest';
import { toHotkeyFormat } from './hotkeyFormat';

describe('toHotkeyFormat', () => {
  // Single keys
  it('converts single letter to lowercase', () => {
    expect(toHotkeyFormat('n')).toBe('n');
  });

  it('converts uppercase letter to lowercase', () => {
    expect(toHotkeyFormat('G')).toBe('shift+g');
  });

  it('converts "/" to "slash"', () => {
    expect(toHotkeyFormat('/')).toBe('slash');
  });

  it('converts "?" to "shift+slash"', () => {
    expect(toHotkeyFormat('?')).toBe('shift+slash');
  });

  it('converts "Space" to "space"', () => {
    expect(toHotkeyFormat('Space')).toBe('space');
  });

  it('converts "Escape" to "escape"', () => {
    expect(toHotkeyFormat('Escape')).toBe('escape');
  });

  it('converts "Enter" to "enter"', () => {
    expect(toHotkeyFormat('Enter')).toBe('enter');
  });

  // Modifier combos — Ctrl produces both ctrl and meta variants for Mac
  it('converts "Ctrl+Enter" to "ctrl+enter, meta+enter"', () => {
    expect(toHotkeyFormat('Ctrl+Enter')).toBe('ctrl+enter, meta+enter');
  });

  it('converts "Ctrl+d" to "ctrl+d, meta+d"', () => {
    expect(toHotkeyFormat('Ctrl+d')).toBe('ctrl+d, meta+d');
  });

  it('converts "Ctrl+Home" to "ctrl+home, meta+home"', () => {
    expect(toHotkeyFormat('Ctrl+Home')).toBe('ctrl+home, meta+home');
  });

  it('converts "Alt+k" to "alt+k"', () => {
    expect(toHotkeyFormat('Alt+k')).toBe('alt+k');
  });

  // Arrow keys
  it('converts "ArrowUp" to "arrowup"', () => {
    expect(toHotkeyFormat('ArrowUp')).toBe('arrowup');
  });

  it('converts "ArrowDown" to "arrowdown"', () => {
    expect(toHotkeyFormat('ArrowDown')).toBe('arrowdown');
  });

  // Bracket keys
  it('converts "[" to "["', () => {
    expect(toHotkeyFormat('[')).toBe('[');
  });

  it('converts "]" to "]"', () => {
    expect(toHotkeyFormat(']')).toBe(']');
  });

  // Multi-modifier
  it('converts "Ctrl+Shift+k" to "ctrl+shift+k, meta+shift+k"', () => {
    expect(toHotkeyFormat('Ctrl+Shift+k')).toBe('ctrl+shift+k, meta+shift+k');
  });
});
