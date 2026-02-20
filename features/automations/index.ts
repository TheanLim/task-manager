// Public API for the automations feature

// Components
export { AutomationTab } from './components/AutomationTab';
export { RuleDialog } from './components/wizard/RuleDialog';
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
export { RuleExecutor } from './services/execution/ruleExecutor';
export { getActionHandler, ACTION_HANDLER_REGISTRY } from './services/execution/actionHandlers';
export type { ActionHandler, ActionContext } from './services/execution/actionHandlers';
export { evaluateRules } from './services/evaluation/ruleEngine';
export { detectBrokenRules } from './services/rules/brokenRuleDetector';
export { formatAutomationToastMessage } from './services/preview/toastMessageFormatter';
export { validateImportedRules } from './services/rules/ruleImportExport';
export { collectSectionReferences } from './services/rules/sectionReferenceCollector';

// Repository
export { LocalStorageAutomationRuleRepository } from './repositories/localStorageAutomationRuleRepository';
export type { AutomationRuleRepository } from './repositories/types';

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
