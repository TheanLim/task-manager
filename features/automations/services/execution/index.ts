// Barrel export for execution sub-module

export { RuleExecutor } from './ruleExecutor';
export { getActionHandler, ACTION_HANDLER_REGISTRY } from './actionHandlers';
export type { ActionHandler, ActionContext } from './actionHandlers';
export {
  getUndoSnapshot,
  getUndoSnapshots,
  pushUndoSnapshot,
  setUndoSnapshot,
  clearAllUndoSnapshots,
  clearUndoSnapshot,
  performUndo,
  performUndoById,
  buildUndoSnapshot,
  UNDO_EXPIRY_MS,
} from './undoService';
export { shouldSkipCreateCard, getLookbackMs } from './createCardDedup';
export { interpolateTitle } from './titleTemplateEngine';
