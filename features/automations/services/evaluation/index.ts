// Barrel export for evaluation sub-module

export { evaluateRules, buildRuleIndex } from './ruleEngine';
export { evaluateFilter, evaluateFilters, filterPredicateMap } from './filterPredicates';
export type { FilterContext, FilterPredicate } from './filterPredicates';
export { calculateRelativeDate, calculateWorkingDays, countWorkingDaysBetween } from './dateCalculations';
