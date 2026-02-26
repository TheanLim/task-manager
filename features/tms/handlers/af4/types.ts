import { z } from 'zod';
import { Task } from '@/types';

export const AF4StateSchema = z.object({
  backlogTaskIds:    z.array(z.string().min(1)),
  activeListTaskIds: z.array(z.string().min(1)),
  currentPosition:   z.number(),
  lastPassHadWork:   z.boolean(),
  dismissedTaskIds:  z.array(z.string().min(1)),
  phase:             z.enum(['backlog', 'active']),
});

export interface AF4State {
  backlogTaskIds: string[];
  activeListTaskIds: string[];
  currentPosition: number;
  lastPassHadWork: boolean;
  dismissedTaskIds: string[];
  phase: 'backlog' | 'active';
}

export type AF4Action =
  | { type: 'MADE_PROGRESS' }
  | { type: 'MARK_DONE' }
  | { type: 'SKIP_TASK' }
  | { type: 'FLAG_DISMISSED' }
  | { type: 'RESOLVE_DISMISSED'; taskId: string; resolution: 'abandon' | 're-enter' | 'defer' }
  | { type: 'ADVANCE_AFTER_FULL_PASS'; tasks: Task[] }
  | { type: 'PROMOTE_ACTIVE_LIST' };
