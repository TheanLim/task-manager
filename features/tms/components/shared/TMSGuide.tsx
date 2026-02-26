import { Lightbulb, X, HelpCircle } from 'lucide-react';

// ── Guide content per system (placeholder — user will customize later) ────────

const GUIDE_CONTENT: Record<string, { title: string; body: string; loop: string }> = {
  none: {
    title: 'How Review Queue Works',
    body: 'Tasks are sorted by how long they\'ve been sitting — oldest floats to the top. The first task is flagged "Needs Attention." Either work on it, complete it, or hit Reinsert to push it to the back of the line.',
    loop: 'Oldest task surfaces → Act on it or Reinsert → Repeat',
  },
  dit: {
    title: 'How Do It Tomorrow Works',
    body: 'Three zones: Today, Tomorrow, and Inbox. New tasks land in the Inbox. Move them to Today or Tomorrow. Each morning, Tomorrow\'s tasks automatically roll over to Today. Your job: focus only on Today.',
    loop: 'Work Today\'s list → New tasks go to Tomorrow → Tomorrow becomes Today overnight',
  },
  af4: {
    title: 'How Autofocus 4 Works',
    body: 'Your tasks are split by a line into two lists: the Backlog (above) and the Active List (below). Go through the Backlog one by one — for each task, either work on it (Made Progress moves it to the Active List for later), Skip it, mark it Done, or Flag it as stuck. Keep looping through the Backlog until you complete a full pass with nothing done. Then do one pass through the Active List the same way, and return to the Backlog. Once every Backlog task is cleared, the Active List becomes the new Backlog and you draw a fresh line. Flagged tasks are ones you keep avoiding — click the ⚠ icon to decide: Abandon it, Re-enter it on the Active List for another try, or Defer it back to the Backlog for later.',
    loop: 'Loop Backlog → nothing left to do? → One Active List pass → Back to Backlog → Backlog empty? → Active List becomes new Backlog',
  },
  fvp: {
    title: 'How FVP Works',
    body: 'FVP picks your next task through quick pairwise comparisons. Hit Start Preselection — the first task becomes your reference (X). For each task after it, ask yourself: "Do I want to do this more than X?" If yes, dot it — it becomes the new X. Keep going until nothing beats the current X. The last dotted task is the one you most want to do right now — that\'s your Do Now. Work on it (you don\'t have to finish — re-enter it at the end if needed). Then resume comparing from where you left off, using the previous dotted task as X. This way your brain sorts urgency, importance, and readiness for you below the surface, just by answering one simple question repeatedly.',
    loop: 'Dot the task you want to do most → Do it → Resume comparing from where you stopped → Repeat',
  },
};

// ── TMSGuide banner ───────────────────────────────────────────────────────────

interface TMSGuideProps {
  systemId: string;
  onDismiss: () => void;
}

export function TMSGuide({ systemId, onDismiss }: TMSGuideProps) {
  const content = GUIDE_CONTENT[systemId];
  if (!content) return null;

  return (
    <div
      className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 relative"
      role="region"
      aria-label={content.title}
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss guide"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-primary">{content.title}</span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed pr-6">
        {content.body}
      </p>

      <p className="text-xs text-foreground font-medium mt-2">
        The loop: {content.loop}
      </p>
    </div>
  );
}

// ── Help button (shown after guide is dismissed) ──────────────────────────────

interface TMSGuideHelpButtonProps {
  onClick: () => void;
}

export function TMSGuideHelpButton({ onClick }: TMSGuideHelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors duration-150"
      aria-label="Show system guide"
      title="How does this system work?"
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </button>
  );
}
