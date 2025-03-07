// src/core/rule-engine.ts
import { Rule, SyncEvent, RuleContext, SyncSettings } from '../types';

export class RuleEngine {
  private rules: Rule[] = [];
  private activeRuleNames: string[] = [];
  private context: RuleContext;
  
  constructor(settings: SyncSettings) {
    // Initialize rule context
    this.context = {
      metaCache: new Map(),
      targetBasePath: settings.targetBasePath,
      contentPath: settings.contentPath,
      assetsPath: settings.assetsPath,
      debug: settings.debugMode
    };
    
    this.activeRuleNames = settings.activeRules;
  }
  
  /**
   * Register a rule with the engine
   */
  registerRule(rule: Rule): void {
    this.rules.push(rule);
    // Sort rules by priority (higher numbers are higher priority)
    this.rules.sort((a, b) => b.priority - a.priority);
    
    if (this.context.debug) {
      console.log(`Registered rule: ${rule.name} (priority: ${rule.priority})`);
    }
  }
  
  /**
   * Apply active rules to an event
   */
  applyRules(event: SyncEvent): SyncEvent {
    if (this.context.debug) {
      console.log(`Applying rules to: ${event.path}`);
    }
    
    let transformedEvent = { ...event };
    
    // Apply each active rule in order
    for (const rule of this.rules) {
      // Skip if the rule is not active
      if (!this.activeRuleNames.includes(rule.name)) {
        continue;
      }
      
      // Skip if the rule shouldn't apply to this event
      if (!rule.shouldApply(transformedEvent)) {
        continue;
      }
      
      // Apply the rule
      if (this.context.debug) {
        console.log(`Applying rule ${rule.name} to ${transformedEvent.path}`);
      }
      
      transformedEvent = rule.apply(transformedEvent, this.context);
      
      if (this.context.debug) {
        console.log(`After ${rule.name}: ${transformedEvent.path}`);
      }
    }
    
    return transformedEvent;
  }
  
  /**
   * Update the metaCache with new meta content
   */
  updateMetaCache(path: string, content: any): void {
    this.context.metaCache.set(path, content);
    
    if (this.context.debug) {
      console.log(`Updated meta cache for ${path}`);
    }
  }
  
  /**
   * Get the list of active rules
   */
  getActiveRules(): string[] {
    return [...this.activeRuleNames];
  }
  
  /**
   * Set the active rules
   */
  setActiveRules(ruleNames: string[]): void {
    this.activeRuleNames = [...ruleNames];
    
    if (this.context.debug) {
      console.log(`Active rules set to: ${this.activeRuleNames.join(', ')}`);
    }
  }
  
  /**
   * Update the rule context with new settings
   */
  updateContext(settings: SyncSettings): void {
    this.context.targetBasePath = settings.targetBasePath;
    this.context.contentPath = settings.contentPath;
    this.context.assetsPath = settings.assetsPath;
    this.context.debug = settings.debugMode;
    
    this.activeRuleNames = settings.activeRules;
    
    if (this.context.debug) {
      console.log('Rule context updated with new settings');
    }
  }
  
  /**
   * Get all registered rules
   */
  getRules(): Rule[] {
    return [...this.rules];
  }
}