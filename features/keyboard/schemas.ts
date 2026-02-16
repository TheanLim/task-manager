import { z } from 'zod';

export const ShortcutBindingSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(['Navigation', 'Global', 'Task Actions']),
  description: z.string(),
});

export const ShortcutMapSchema = z.record(z.string(), ShortcutBindingSchema);
