// Public API for the automations feature

// Components
export { AutomationTab } from './components/AutomationTab';
export { RuleDialog } from './components/RuleDialog';
export { RuleCard } from './components/RuleCard';
export { SectionContextMenuItem } from './components/SectionContextMenuItem';
export { SectionPicker } from './components/SectionPicker';
export { DateOptionSelect } from './components/DateOptionSelect';
export { RulePreview } from './components/RulePreview';
export { RuleCardExecutionLog } from './components/RuleCardExecutionLog';

// Hooks
export { useAutomationRules } from './hooks/useAutomationRules';
export { useUndoAutomation } from './hooks/useUndoAutomation';

// Services
export { AutomationService } from './services/automationService';
export { RuleExecutor } from './services/ruleExecutor';
export { evaluateRules } from './services/ruleEngine';
export { detectBrokenRules } from './services/brokenRuleDetector';
export { formatAutomationToastMessage } from './services/toastMessageFormatter';
export { validateImportedRules } from './services/ruleImportExport';

// Repository
export { LocalStorageAutomationRuleRepository } from './repositories/localStorageAutomationRuleRepository';
export type { AutomationRuleRepository } from './repositories/types';

// Domain events (re-exported from lib/events for backward compat)
export { emitDomainEvent, subscribeToDomainEvents, unsubscribeAll } from './events';

// Types
export type {
  AutomationRule,
  TriggerType,
  ActionType,
  RelativeDateOption,
  Trigger,
  Action,
  CardFilter,
  CardFilterType,
  ExecutionLogEntry,
  DomainEvent,
  UndoSnapshot,
  BatchContext,
  RuleAction,
  EvaluationContext,
} from './types';
