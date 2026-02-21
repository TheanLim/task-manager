import { describe, it, expect } from 'vitest';
import { resolveDirection, VIM_KEY_MAP, ARROW_KEY_MAP } from './keyMappings';

describe('resolveDirection', () => {
  // Ctrl combos
  it('Ctrl+Home → null (removed)', () => {
    expect(resolveDirection('Home', true, false)).toBeNull();
  });

  it('Ctrl+ArrowUp → null', () => {
    expect(resolveDirection('ArrowUp', true, false)).toBeNull();
  });

  it('Ctrl+End → null (removed)', () => {
    expect(resolveDirection('End', true, false)).toBeNull();
  });

  it('Ctrl+ArrowDown → null', () => {
    expect(resolveDirection('ArrowDown', true, false)).toBeNull();
  });

  it('Ctrl+d → null (handled by shortcut map)', () => {
    expect(resolveDirection('d', true, false)).toBeNull();
  });

  it('Ctrl+u → null (handled by shortcut map)', () => {
    expect(resolveDirection('u', true, false)).toBeNull();
  });

  it('Ctrl+unknown → null', () => {
    expect(resolveDirection('x', true, false)).toBeNull();
  });

  // Arrow keys
  it('ArrowUp → up', () => {
    expect(resolveDirection('ArrowUp', false, false)).toBe('up');
  });

  it('ArrowDown → down', () => {
    expect(resolveDirection('ArrowDown', false, false)).toBe('down');
  });

  it('ArrowLeft → left', () => {
    expect(resolveDirection('ArrowLeft', false, false)).toBe('left');
  });

  it('ArrowRight → right', () => {
    expect(resolveDirection('ArrowRight', false, false)).toBe('right');
  });

  // Home/End removed — no longer mapped
  it('Home → null (removed)', () => {
    expect(resolveDirection('Home', false, false)).toBeNull();
  });

  it('End → null (removed)', () => {
    expect(resolveDirection('End', false, false)).toBeNull();
  });

  // Vim keys
  it('G (shift) → null (handled by shortcut map)', () => {
    expect(resolveDirection('G', false, true)).toBeNull();
  });

  it('h → left', () => {
    expect(resolveDirection('h', false, false)).toBe('left');
  });

  it('j → down', () => {
    expect(resolveDirection('j', false, false)).toBe('down');
  });

  it('k → up', () => {
    expect(resolveDirection('k', false, false)).toBe('up');
  });

  it('l → right', () => {
    expect(resolveDirection('l', false, false)).toBe('right');
  });

  // Unknown
  it('unknown key → null', () => {
    expect(resolveDirection('z', false, false)).toBeNull();
  });

  it('g without shift → null (gg chord handled by hook)', () => {
    expect(resolveDirection('g', false, false)).toBeNull();
  });
});

describe('VIM_KEY_MAP', () => {
  it('has 4 entries', () => {
    expect(Object.keys(VIM_KEY_MAP)).toHaveLength(4);
  });
});

describe('ARROW_KEY_MAP', () => {
  it('has 4 entries', () => {
    expect(Object.keys(ARROW_KEY_MAP)).toHaveLength(4);
  });
});
