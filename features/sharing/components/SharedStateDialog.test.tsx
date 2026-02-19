import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharedStateDialog, SharedStateDialogProps } from './SharedStateDialog';
import { AppState } from '@/types';

// Mock Radix Dialog to render inline (no portal) so jsdom can query content
vi.mock('@/components/ui/dialog', () => {
  const DialogContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  return {
    Dialog: ({ children, open }: any) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent,
    DialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    DialogFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  };
});

// Mock Checkbox to a native checkbox for easy interaction
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}));

const now = new Date().toISOString();

function makeSharedState(overrides: Partial<AppState> & Record<string, unknown> = {}): AppState {
  return {
    projects: [{ id: 'p1', name: 'Proj', description: '', viewMode: 'list', createdAt: now, updatedAt: now }],
    tasks: [{ id: 't1', projectId: 'p1', parentTaskId: null, sectionId: null, description: 'Task', notes: '', assignee: '', priority: 'none', tags: [], dueDate: null, completed: false, completedAt: null, order: 0, createdAt: now, updatedAt: now }],
    sections: [],
    dependencies: [],
    tmsState: { activeSystem: 'none', dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: now }, af4: { markedTasks: [], markedOrder: [] }, fvp: { dottedTasks: [], currentX: null, selectionInProgress: false } },
    settings: { activeProjectId: null, timeManagementSystem: 'none', showOnlyActionableTasks: false, theme: 'system' },
    version: '1.0',
    ...overrides,
  } as AppState;
}

const emptyCurrentState = { projects: 0, tasks: 0, sections: 0, dependencies: 0 };
const existingCurrentState = { projects: 1, tasks: 3, sections: 2, dependencies: 1 };

function renderDialog(overrides: Partial<SharedStateDialogProps> = {}) {
  const props: SharedStateDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    sharedState: makeSharedState(),
    currentState: emptyCurrentState,
    onConfirm: vi.fn(),
    ...overrides,
  };
  const result = render(<SharedStateDialog {...props} />);
  return { ...result, props };
}

describe('SharedStateDialog', () => {
  describe('automation rule count', () => {
    it('renders automation rule count when shared state contains automationRules', () => {
      renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] } as any),
      });

      expect(screen.getByText('3 automation rule(s)')).toBeInTheDocument();
    });

    it('does not render automation rule count when automationRules is absent', () => {
      renderDialog();

      expect(screen.queryByText(/automation rule/)).not.toBeInTheDocument();
    });

    it('does not render automation rule count when automationRules is empty', () => {
      renderDialog({
        sharedState: makeSharedState({ automationRules: [] } as any),
      });

      expect(screen.queryByText(/automation rule/)).not.toBeInTheDocument();
    });
  });

  describe('include automations checkbox', () => {
    it('shows checkbox when automation rules exist', () => {
      renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
      });

      expect(screen.getByLabelText('Include automations')).toBeInTheDocument();
    });

    it('hides checkbox when no automation rules in shared state', () => {
      renderDialog();

      expect(screen.queryByLabelText('Include automations')).not.toBeInTheDocument();
    });

    it('hides checkbox when automationRules is not an array', () => {
      renderDialog({
        sharedState: makeSharedState({ automationRules: 'not-an-array' } as any),
      });

      expect(screen.queryByLabelText('Include automations')).not.toBeInTheDocument();
    });

    it('checkbox is checked by default', () => {
      renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
      });

      expect(screen.getByLabelText('Include automations')).toBeChecked();
    });
  });

  describe('onConfirm with automation options', () => {
    it('passes includeAutomations: true by default on replace', async () => {
      const user = userEvent.setup();
      const { props } = renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
        currentState: existingCurrentState,
      });

      await user.click(screen.getByRole('button', { name: 'Replace All' }));

      expect(props.onConfirm).toHaveBeenCalledWith('replace', { includeAutomations: true });
    });

    it('passes includeAutomations: true by default on merge', async () => {
      const user = userEvent.setup();
      const { props } = renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
        currentState: existingCurrentState,
      });

      await user.click(screen.getByRole('button', { name: 'Merge' }));

      expect(props.onConfirm).toHaveBeenCalledWith('merge', { includeAutomations: true });
    });

    it('passes includeAutomations: false when checkbox is unchecked before confirming', async () => {
      const user = userEvent.setup();
      const { props } = renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
        currentState: existingCurrentState,
      });

      await user.click(screen.getByLabelText('Include automations'));
      await user.click(screen.getByRole('button', { name: 'Merge' }));

      expect(props.onConfirm).toHaveBeenCalledWith('merge', { includeAutomations: false });
    });

    it('does not pass automation options on cancel', async () => {
      const user = userEvent.setup();
      const { props } = renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
        currentState: existingCurrentState,
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(props.onConfirm).toHaveBeenCalledWith('cancel');
    });

    it('passes includeAutomations: true on Load when no current data', async () => {
      const user = userEvent.setup();
      const { props } = renderDialog({
        sharedState: makeSharedState({ automationRules: [{ id: 'r1' }] } as any),
        currentState: emptyCurrentState,
      });

      await user.click(screen.getByRole('button', { name: 'Load' }));

      expect(props.onConfirm).toHaveBeenCalledWith('replace', { includeAutomations: true });
    });
  });

  describe('dialog rendering', () => {
    it('does not render when open is false', () => {
      renderDialog({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows shared data counts', () => {
      renderDialog();

      expect(screen.getByText('1 project(s)')).toBeInTheDocument();
      expect(screen.getByText('1 task(s)')).toBeInTheDocument();
    });
  });
});
