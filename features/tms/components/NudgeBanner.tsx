'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ENABLE_TMS_NUDGE_BANNER } from '../flags';
import { tmsCopy } from '../copy/tms-copy';

const DISMISSED_KEY = 'tms-nudge-dismissed';

export function NudgeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) !== null;
  });

  if (!ENABLE_TMS_NUDGE_BANNER || dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div
      role="banner"
      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-950 border border-blue-800 rounded-md text-sm text-blue-200"
    >
      <span>{tmsCopy.nudgeBanner.message}</span>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/?view=tasks"
          className="text-blue-300 hover:text-blue-100 underline underline-offset-2 font-medium"
        >
          {tmsCopy.nudgeBanner.ctaLabel}
        </a>
        <button
          type="button"
          aria-label={tmsCopy.nudgeBanner.dismissAriaLabel}
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-200 transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
