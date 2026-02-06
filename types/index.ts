// Base types
export type UUID = string;
export type ISODateString = string;

// Enums
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

// Project
export interface Project {
  id: UUID;
  name: string;
  description: string;
  viewMode: ViewMode;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Future extensibility
  color?: string;
  icon?: string;
}

// Section (unified for both list and board views)
export interface Section {
  id: UUID;
  projectId: UUID;
  name: string;
  order: number;
  collapsed: boolean; // For list view collapsible state
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Task
export interface Task {
  id: UUID;
  projectId: UUID;
  parentTaskId: UUID | null; // null for top-level tasks
  sectionId: UUID | null; // Unified reference for both list and board views
  description: string;
  notes: string;
  assignee: string;
  priority: Priority;
  tags: string[];
  dueDate: ISODateString | null;
  completed: boolean;
  completedAt: ISODateString | null;
  order: number; // for ordering within section
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Future extensibility
  comments?: Comment[];
  attachments?: Attachment[];
  customFields?: Record<string, any>;
}

// Task Dependency
export interface TaskDependency {
  id: UUID;
  blockingTaskId: UUID; // Task that must be completed first
  blockedTaskId: UUID;  // Task that is blocked
  createdAt: ISODateString;
}

// Time Management System State
export interface TMSState {
  activeSystem: TimeManagementSystem;
  
  // DIT state
  dit: {
    todayTasks: UUID[];
    tomorrowTasks: UUID[];
    lastDayChange: ISODateString;
  };
  
  // AF4 state
  af4: {
    markedTasks: UUID[];
    markedOrder: UUID[]; // Order in which tasks were marked
  };
  
  // FVP state
  fvp: {
    dottedTasks: UUID[];
    currentX: UUID | null;
    selectionInProgress: boolean;
  };
}

// Application Settings
export interface AppSettings {
  activeProjectId: UUID | null;
  timeManagementSystem: TimeManagementSystem;
  showOnlyActionableTasks: boolean;
  theme: 'light' | 'dark' | 'system';
  // Future extensibility
  notifications?: boolean;
  defaultPriority?: Priority;
}

// Complete Application State
export interface AppState {
  projects: Project[];
  tasks: Task[];
  sections: Section[];
  dependencies: TaskDependency[];
  tmsState: TMSState;
  settings: AppSettings;
  version: string; // For data migration
}

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
