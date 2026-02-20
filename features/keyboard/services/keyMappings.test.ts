import { describe, it, expect } from 'vitest';
import { resolveDirection, VIM_KEY_MAP, ARROW_KEY_MAP } from './keyMappings';

describe('resolveDirection', () => {
  // Ctrl combos
  it('Ctrl+Home → gridHome', () => {
    expect(resolveDirection('Home', true, false)).toBe('gridHome');
  });

  it('Ctrl+ArrowUp → gridHome', () => {
    expect(resolveDirection('ArrowUp', true, false)).toBe('gridHome');
  });

  it('Ctrl+End → gridEnd', () => {
    expect(resolveDirection('End', true, false)).toBe('gridEnd');
  });

  it('Ctrl+ArrowDown → gridEnd', () => {
    expect(resolveDirection('ArrowDown', true, false)).toBe('gridEnd');
  });

  it('Ctrl+d → halfPageDown', () => {
    expect(resolveDirection('d', true, false)).toBe('halfPageDown');
  });

  it('Ctrl+u → halfPageUp', () => {
    expect(resolveDirection('u', true, false)).toBe('halfPageUp');
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

  // Home/End
  it('Home → home', () => {
    expect(resolveDirection('Home', false, false)).toBe('home');
  });

  it('End → end', () => {
    expect(resolveDirection('End', false, false)).toBe('end');
  });

  // Vim keys
  it('G (shift) → lastRow', () => {
    expect(resolveDirection('G', false, true)).toBe('lastRow');
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
