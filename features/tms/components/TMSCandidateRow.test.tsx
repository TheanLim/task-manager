import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TMSCandidateRow } from './TMSCandidateRow';

function renderRow(props: Parameters<typeof TMSCandidateRow>[0]) {
  return render(
    <TMSCandidateRow {...props}>
      <span data-testid="child">content</span>
    </TMSCandidateRow>,
  );
}

describe('TMSCandidateRow', () => {
  it('isCandidate=true, mode="af4" applies border-l-violet-500 and bg-violet-950/30', () => {
    const { container } = renderRow({ mode: 'af4', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('border-l-violet-500');
    expect(div.className).toContain('bg-violet-950/30');
  });

  it('isCandidate=true, mode="dit" applies border-l-amber-500 and bg-amber-950/30', () => {
    const { container } = renderRow({ mode: 'dit', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('border-l-amber-500');
    expect(div.className).toContain('bg-amber-950/30');
  });

  it('isCandidate=true, mode="fvp" applies border-l-blue-500 and bg-blue-950/30', () => {
    const { container } = renderRow({ mode: 'fvp', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('border-l-blue-500');
    expect(div.className).toContain('bg-blue-950/30');
  });

  it('isCandidate=false renders children unchanged — no border/tint classes', () => {
    const { container } = renderRow({ mode: 'af4', isCandidate: false });
    // No wrapper div — children rendered directly
    expect(screen.getByTestId('child')).toBeInTheDocument();
    const div = container.querySelector('div');
    expect(div).toBeNull();
  });

  it('transition-all duration-200 present when isCandidate=true (af4)', () => {
    const { container } = renderRow({ mode: 'af4', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('transition-all');
    expect(div.className).toContain('duration-200');
  });

  it('transition-all duration-200 present when isCandidate=true (dit)', () => {
    const { container } = renderRow({ mode: 'dit', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('transition-all');
    expect(div.className).toContain('duration-200');
  });

  it('transition-all duration-200 present when isCandidate=true (fvp)', () => {
    const { container } = renderRow({ mode: 'fvp', isCandidate: true });
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('transition-all');
    expect(div.className).toContain('duration-200');
  });

  it('mode="standard", isCandidate=true — no border class, no tint class (passthrough)', () => {
    const { container } = renderRow({ mode: 'standard', isCandidate: true });
    expect(screen.getByTestId('child')).toBeInTheDocument();
    const div = container.querySelector('div');
    expect(div).toBeNull();
  });

  it('mode="standard", isCandidate=false — no visual treatment', () => {
    const { container } = renderRow({ mode: 'standard', isCandidate: false });
    expect(screen.getByTestId('child')).toBeInTheDocument();
    const div = container.querySelector('div');
    expect(div).toBeNull();
  });

  it('mode="none", isCandidate=true — no visual treatment', () => {
    const { container } = renderRow({ mode: 'none', isCandidate: true });
    expect(screen.getByTestId('child')).toBeInTheDocument();
    const div = container.querySelector('div');
    expect(div).toBeNull();
  });

  it('children are always rendered', () => {
    renderRow({ mode: 'af4', isCandidate: true });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
