// Public API for the tasks feature

// Components
export { TaskList } from './components/TaskList';
export { TaskBoard } from './components/TaskBoard';
export { TaskCalendar } from './components/TaskCalendar';
export { TaskDetailPanel } from './components/TaskDetailPanel';
export { TaskDialog } from './components/TaskDialog';
export { TaskRow } from './components/TaskRow';
export { DependencyDialog } from './components/DependencyDialog';
export { DependencyList } from './components/DependencyList';
export { GlobalTasksView } from './components/GlobalTasksView';
export { GlobalTasksHeader } from './components/GlobalTasksHeader';
export { GlobalTasksContainer } from './components/GlobalTasksContainer';
export { RichTextEditor } from './components/RichTextEditor';

// Hooks
export { useFilteredTasks } from './hooks/useFilteredTasks';

// Services
export { TaskService } from './services/taskService';
export { DependencyService } from './services/dependencyService';
export { filterAutoHiddenTasks, isTaskAutoHidden } from './services/autoHideService';
export { DependencyResolverImpl } from './services/dependencyResolver';
export type { DependencyResolver } from './services/dependencyResolver';

// Stores
export { useFilterStore } from './stores/filterStore';
