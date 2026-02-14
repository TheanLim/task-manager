// Base types
export type UUID = string;
export type ISODateString = string;

// Enums (kept as runtime values — Zod schemas use string enums)
export enum Priority {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum ViewMode {
  LIST = 'list',
  BOARD = 'board',
  CALENDAR = 'calendar'
}

export enum TimeManagementSystem {
  NONE = 'none',
  DIT = 'dit',
  AF4 = 'af4',
  FVP = 'fvp'
}

// Re-export Zod-inferred types as canonical types
export type {
  Project,
  Task,
  Section,
  TaskDependency,
  TMSState,
  AppSettings,
  AppState,
} from '@/lib/schemas';

// Future extensibility types
export interface Comment {
  id: UUID;
  taskId: UUID;
  author: string;
  content: string;
  createdAt: ISODateString;
}

export interface Attachment {
  id: UUID;
  taskId: UUID;
  filename: string;
  url: string;
  size: number;
  createdAt: ISODateString;
}
