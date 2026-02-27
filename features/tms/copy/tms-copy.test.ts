import { describe, it, expect } from 'vitest';
import { tmsCopy } from './tms-copy';

describe('tmsCopy', () => {
  describe('fvpProgress', () => {
    it('formats 0 of 0', () => {
      expect(tmsCopy.fvpProgress(0, 0)).toBe('FVP — 0 of 0');
    });

    it('formats n of total', () => {
      expect(tmsCopy.fvpProgress(7, 23)).toBe('FVP — 7 of 23');
    });
  });

  describe('fvpProgressNarrow', () => {
    it('formats narrow variant', () => {
      expect(tmsCopy.fvpProgressNarrow(7, 23)).toBe('FVP 7/23');
    });
  });

  describe('confirmDialog', () => {
    it('title includes toMode', () => {
      expect(tmsCopy.confirmDialog.title('AF4')).toBe('Switch to AF4?');
    });

    it('fvpBody contains progress count', () => {
      expect(tmsCopy.confirmDialog.fvpBody(18, 30)).toContain('18 of 30');
    });

    it('toFvpBody contains fromMode and snapshot', () => {
      const body = tmsCopy.confirmDialog.toFvpBody('DIT');
      expect(body).toContain('DIT');
      expect(body).toContain('snapshot');
    });

    it('genericBody contains fromMode and session will end', () => {
      const body = tmsCopy.confirmDialog.genericBody('AF4');
      expect(body).toContain('AF4');
      expect(body).toContain('session will end');
    });

    it('confirmButton includes toMode', () => {
      expect(tmsCopy.confirmDialog.confirmButton('AF4')).toBe('Switch to AF4');
    });

    it('cancelButton is non-empty', () => {
      expect(tmsCopy.confirmDialog.cancelButton).toBe('Cancel');
    });
  });

  describe('srAnnouncements', () => {
    it('FVP activated message contains snapshotted', () => {
      expect(tmsCopy.srAnnouncements.activated.FVP).toContain('snapshotted');
    });

    it('all activated keys are non-empty strings', () => {
      const modes = ['AF4', 'DIT', 'FVP', 'Standard', 'none'] as const;
      for (const mode of modes) {
        expect(typeof tmsCopy.srAnnouncements.activated[mode]).toBe('string');
        expect(tmsCopy.srAnnouncements.activated[mode].length).toBeGreaterThan(0);
      }
    });

    it('exited is a non-empty string', () => {
      expect(typeof tmsCopy.srAnnouncements.exited).toBe('string');
      expect(tmsCopy.srAnnouncements.exited.length).toBeGreaterThan(0);
    });
  });

  describe('popover.options', () => {
    it('FVP description contains session start snapshot caveat', () => {
      expect(tmsCopy.popover.options.FVP.description).toContain('session start');
    });

    it('all options have non-empty name and description', () => {
      const keys = ['None', 'AF4', 'DIT', 'FVP', 'Standard'] as const;
      for (const key of keys) {
        expect(tmsCopy.popover.options[key].name.length).toBeGreaterThan(0);
        expect(tmsCopy.popover.options[key].description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('pill', () => {
    it('idleLabel is non-empty', () => {
      expect(tmsCopy.pill.idleLabel.length).toBeGreaterThan(0);
    });

    it('activeLabel returns mode string', () => {
      expect(tmsCopy.pill.activeLabel('AF4')).toBe('AF4');
    });
  });

  describe('inlineNotices', () => {
    it('all inline notice strings are non-empty', () => {
      expect(tmsCopy.inlineNotices.viewChanged.length).toBeGreaterThan(0);
      expect(tmsCopy.inlineNotices.queueComplete.length).toBeGreaterThan(0);
      expect(tmsCopy.inlineNotices.noFvpCandidates.length).toBeGreaterThan(0);
    });
  });

  describe('nudgeBanner', () => {
    it('ctaLabel is "Take me there →"', () => {
      expect(tmsCopy.nudgeBanner.ctaLabel).toBe('Take me there →');
    });

    it('dismissAriaLabel is "Dismiss this notice"', () => {
      expect(tmsCopy.nudgeBanner.dismissAriaLabel).toBe('Dismiss this notice');
    });

    it('message is non-empty', () => {
      expect(tmsCopy.nudgeBanner.message.length).toBeGreaterThan(0);
    });
  });

  describe('migrationTooltip', () => {
    it('contains "Review Queue moved here"', () => {
      expect(tmsCopy.migrationTooltip).toContain('Review Queue moved here');
    });
  });
});
