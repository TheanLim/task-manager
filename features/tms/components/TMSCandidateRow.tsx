import React from 'react';
import { cn } from '@/lib/utils';

interface TMSCandidateRowProps {
  mode: 'af4' | 'dit' | 'fvp' | 'standard' | 'none';
  isCandidate: boolean;
  children: React.ReactNode;
}

const CANDIDATE_CLASSES: Record<string, string> = {
  af4: 'border-l-2 border-l-violet-500 bg-violet-950/30',
  dit: 'border-l-2 border-l-amber-500 bg-amber-950/30',
  fvp: 'border-l-2 border-l-blue-500 bg-blue-950/30',
};

export function TMSCandidateRow({ mode, isCandidate, children }: TMSCandidateRowProps) {
  const accentClasses = CANDIDATE_CLASSES[mode];
  const shouldApply = isCandidate && !!accentClasses;

  if (!shouldApply) {
    return <>{children}</>;
  }

  return (
    <div className={cn(accentClasses, 'transition-all duration-200')}>
      {children}
    </div>
  );
}
