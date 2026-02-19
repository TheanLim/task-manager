import { Priority } from '@/types';

export function getPriorityVariant(priority: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (priority) {
    case Priority.HIGH: return 'destructive';
    case Priority.MEDIUM: return 'default';
    case Priority.LOW: return 'secondary';
    default: return 'outline';
  }
}
