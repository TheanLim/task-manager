import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagEditorPopover } from './TagEditorPopover';

describe('TagEditorPopover', () => {
  it('renders the trigger content', () => {
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );
    expect(screen.getByText('Edit tags')).toBeInTheDocument();
  });

  it('shows input and Add button when opened', async () => {
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    expect(screen.getByPlaceholderText('Add tag...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('calls onAddTag when typing and pressing Enter', async () => {
    const onAddTag = vi.fn();
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={onAddTag}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    await user.type(screen.getByPlaceholderText('Add tag...'), 'urgent{Enter}');
    expect(onAddTag).toHaveBeenCalledWith('urgent');
  });

  it('calls onAddTag when clicking Add button', async () => {
    const onAddTag = vi.fn();
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={onAddTag}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    await user.type(screen.getByPlaceholderText('Add tag...'), 'urgent');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddTag).toHaveBeenCalledWith('urgent');
  });

  it('does not call onAddTag for empty/whitespace input', async () => {
    const onAddTag = vi.fn();
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={onAddTag}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    await user.type(screen.getByPlaceholderText('Add tag...'), '   {Enter}');
    expect(onAddTag).not.toHaveBeenCalled();
  });

  it('does not call onAddTag for duplicate tags', async () => {
    const onAddTag = vi.fn();
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={['urgent']}
        onAddTag={onAddTag}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    await user.type(screen.getByPlaceholderText('Add tag...'), 'urgent{Enter}');
    expect(onAddTag).not.toHaveBeenCalled();
  });

  it('displays existing tags with remove buttons', async () => {
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={['bug', 'feature']}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
  });

  it('Add button is disabled when input is empty', async () => {
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('clears input after adding a tag', async () => {
    const user = userEvent.setup();
    render(
      <TagEditorPopover
        tags={[]}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        trigger={<button>Edit tags</button>}
      />
    );

    await user.click(screen.getByText('Edit tags'));
    const input = screen.getByPlaceholderText('Add tag...');
    await user.type(input, 'urgent{Enter}');
    expect(input).toHaveValue('');
  });
});
