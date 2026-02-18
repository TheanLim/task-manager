import type { AutomationRuleRepository } from './types';
import type { AutomationRule } from '../types';
import type { SubscriptionCallback, Unsubscribe } from '@/lib/repositories/types';
import { AutomationRuleSchema } from '../schemas';

const STORAGE_KEY = 'task-management-automations';

/**
 * LocalStorage implementation of AutomationRuleRepository.
 * Stores automation rules in a dedicated localStorage key, separate from main app state.
 *
 * Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class LocalStorageAutomationRuleRepository implements AutomationRuleRepository {
  private rules: AutomationRule[];
  private listeners: Set<SubscriptionCallback<AutomationRule>>;

  constructor() {
    this.listeners = new Set();
    this.rules = this.loadFromStorage();
  }

  /**
   * Load automation rules from localStorage.
   * Returns empty array if localStorage is unavailable (SSR) or if data is invalid.
   */
  private loadFromStorage(): AutomationRule[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.error('Invalid automation rules data: expected array');
        return [];
      }

      // Validate each rule with Zod
      const validated = parsed
        .map((item) => {
          const result = AutomationRuleSchema.safeParse(item);
          if (!result.success) {
            console.error('Invalid automation rule:', result.error.format());
            return null;
          }
          return result.data;
        })
        .filter((rule): rule is AutomationRule => rule !== null);

      return validated;
    } catch (error) {
      console.error('Failed to load automation rules from localStorage:', error);
      return [];
    }
  }

  /**
   * Persist current rules to localStorage.
   * Silently fails if localStorage is unavailable (SSR).
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('localStorage quota exceeded');
      }
      throw error;
    }
  }

  /**
   * Notify all subscribers with the current rule list.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener([...this.rules]);
    }
  }

  findById(id: string): AutomationRule | undefined {
    return this.rules.find((rule) => rule.id === id);
  }

  findAll(): AutomationRule[] {
    return [...this.rules];
  }

  findByProjectId(projectId: string): AutomationRule[] {
    return this.rules.filter((rule) => rule.projectId === projectId);
  }

  create(item: AutomationRule): void {
    // Validate with Zod before adding
    const validated = AutomationRuleSchema.parse(item);
    this.rules.push(validated);
    this.saveToStorage();
    this.notifyListeners();
  }

  update(id: string, updates: Partial<AutomationRule>): void {
    const index = this.rules.findIndex((rule) => rule.id === id);
    if (index === -1) {
      return;
    }

    const updated = { ...this.rules[index], ...updates };
    // Validate the updated rule
    const validated = AutomationRuleSchema.parse(updated);
    this.rules[index] = validated;
    this.saveToStorage();
    this.notifyListeners();
  }

  delete(id: string): void {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.id !== id);

    if (this.rules.length !== initialLength) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  replaceAll(items: AutomationRule[]): void {
    // Validate all items before replacing
    const validated = items.map((item) => AutomationRuleSchema.parse(item));
    this.rules = validated;
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(callback: SubscriptionCallback<AutomationRule>): Unsubscribe {
    this.listeners.add(callback);
    // Immediately invoke callback with current state
    callback([...this.rules]);

    return () => {
      this.listeners.delete(callback);
    };
  }
}
