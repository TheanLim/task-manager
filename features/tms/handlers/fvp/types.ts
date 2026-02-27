import { z } from 'zod';
import { Task } from '@/types';

export const FVPStateSchema = z.object({
  dottedTasks: z.array(z.string().min(1)),
  scanPosition: z.number(),
  snapshotTaskIds: z.array(z.string().min(1)).default([]),
});

export interface FVPState {
  dottedTasks: string[];
  scanPosition: number;
  snapshotTaskIds: string[];
}

export type FVPAction =
  | { type: 'START_PRESELECTION'; tasks: Task[] }
  | { type: 'DOT_TASK'; task: Task; tasks: Task[] }
  | { type: 'SKIP_CANDIDATE'; task: Task; tasks: Task[] }
  | { type: 'COMPLETE_CURRENT'; tasks: Task[] }
  | { type: 'REENTER_CURRENT'; tasks: Task[] }
  | { type: 'RESET_FVP' };
