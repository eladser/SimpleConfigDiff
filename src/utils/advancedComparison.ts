import { PathRule, ValueTransformation, DiffOptions } from '@/types';

/**
 * Advanced comparison utilities for semantic and rule-based diff processing
 */

export class SemanticComparator {
  private options: DiffOptions;

  constructor(options: DiffOptions) {
    this.options = options;
  }

  /**
   * Performs semantic comparison of two values
   */
  semanticEquals(left: any, right: any): boolean {
    // Handle null/undefined equivalence
    if (this.isNullish(left) && this.isNullish(right)) {
      return true;
    }

    // Handle boolean equivalence
    if (this.isBooleanEquivalent(left, right)) {
      return true;
    }

    // Handle numeric equivalence
    if (this.isNumericEquivalent(left, right)) {
      return true;
    }

    // Handle string equivalence
    if (this.isStringEquivalent(left, right)) {
      return true;
    }

    // Handle array equivalence
    if (Array.isArray(left) && Array.isArray(right)) {
      return this.arraySemanticEquals(left, right);
    }

    // Handle object equivalence
    if (this.isObject(left) && this.isObject(right)) {
      return this.objectSemanticEquals(left, right);
    }

    return false;
  }

  private isNullish(value: any): boolean {
    return value === null || value === undefined || value === '';
  }

  private isBooleanEquivalent(left: any, right: any): boolean {
    const leftBool = this.toBooleanValue(left);
    const rightBool = this.toBooleanValue(right);
    return leftBool !== null && rightBool !== null && leftBool === rightBool;
  }

  private toBooleanValue(value: any): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (['true', 'yes', 'on', '1', 'enabled'].includes(lower)) return true;
      if (['false', 'no', 'off', '0', 'disabled'].includes(lower)) return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    return null;
  }

  private isNumericEquivalent(left: any, right: any): boolean {
    const leftNum = this.toNumber(left);
    const rightNum = this.toNumber(right);
    return leftNum !== null && rightNum !== null && leftNum === rightNum;
  }

  private toNumber(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private isStringEquivalent(left: any, right: any): boolean {
    if (typeof left === 'string' && typeof right === 'string') {
      if (!this.options.caseSensitive) {
        return left.toLowerCase() === right.toLowerCase();
      }
      if (this.options.ignoreWhitespace) {
        return left.trim().replace(/\s+/g, ' ') === right.trim().replace(/\s+/g, ' ');
      }
    }
    return false;
  }

  private arraySemanticEquals(left: any[], right: any[]): boolean {
    if (left.length !== right.length) return false;
    
    for (let i = 0; i < left.length; i++) {
      if (!this.semanticEquals(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  private objectSemanticEquals(left: any, right: any): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    
    if (leftKeys.length !== rightKeys.length) return false;
    
    for (const key of leftKeys) {
      if (!rightKeys.includes(key)) return false;
      if (!this.semanticEquals(left[key], right[key])) return false;
    }
    return true;
  }

  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

export class PathMatcher {
  /**
   * Checks if a path matches a given rule
   */
  static matches(path: string, rule: PathRule): boolean {
    switch (rule.type) {
      case 'exact':
        return path === rule.pattern;
      case 'glob':
        return this.globMatch(path, rule.pattern);
      case 'regex':
        try {
          const regex = new RegExp(rule.pattern);
          return regex.test(path);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private static globMatch(path: string, pattern: string): boolean {
    // Simple glob implementation
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any number of path segments
      .replace(/\*/g, '[^.]*')  // * matches any characters except dots
      .replace(/\?/g, '.')      // ? matches any single character
      .replace(/\./g, '\\.');   // Escape dots

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
}

export class ValueTransformer {
  /**
   * Applies value transformations to a value
   */
  static transform(value: any, transformations: ValueTransformation[]): any {
    if (typeof value !== 'string') return value;
    
    let transformed = value;
    
    for (const transformation of transformations) {
      if (!transformation.enabled) continue;
      
      try {
        const regex = new RegExp(transformation.pattern, 'g');
        transformed = transformed.replace(regex, transformation.replacement);
      } catch {
        // Skip invalid regex patterns
        continue;
      }
    }
    
    return transformed;
  }
}

export class DiffSeverityAnalyzer {
  /**
   * Analyzes the severity of a diff change
   */
  static analyzeSeverity(change: any): 'critical' | 'major' | 'minor' | 'cosmetic' {
    const path = change.path.toLowerCase();
    
    // Critical changes - these can break functionality or expose security issues
    if (this.isCriticalPath(path)) {
      return 'critical';
    }
    
    // Security-related changes
    if (this.isSecurityPath(path)) {
      return 'major';
    }
    
    // Performance-related changes
    if (this.isPerformancePath(path)) {
      return 'major';
    }
    
    // Type changes are usually significant
    if (change.oldType !== change.newType) {
      return 'major';
    }
    
    // Large value changes
    if (this.isLargeValueChange(change)) {
      return 'minor';
    }
    
    return 'cosmetic';
  }

  private static isCriticalPath(path: string): boolean {
    const criticalPatterns = [
      // Security credentials
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
      /security/i,
      /ssl/i,
      /tls/i,
      /cert/i,
      
      // Network configuration - CRITICAL for connectivity
      /\.port$/i,              // Any path ending with .port
      /^port$/i,               // Standalone port
      /host$/i,                // Any path ending with host
      /^host$/i,               // Standalone host
      /url$/i,                 // Any path ending with url
      /^url$/i,                // Standalone url
      /endpoint$/i,            // Any path ending with endpoint
      /^endpoint$/i,           // Standalone endpoint
      
      // Database connections
      /database.*host/i,
      /database.*port/i,
      /db.*host/i,
      /db.*port/i,
      
      // Server configuration
      /server.*host/i,
      /server.*port/i,
      /listen.*port/i,
      /bind.*port/i,
      
      // API configuration
      /api.*endpoint/i,
      /api.*host/i,
      /api.*port/i,
      /api.*url/i,
      
      // Service discovery
      /service.*host/i,
      /service.*port/i,
      /registry.*host/i,
      /registry.*port/i,
      
      // Load balancer and proxy
      /proxy.*host/i,
      /proxy.*port/i,
      /upstream.*host/i,
      /upstream.*port/i,
      
      // Message queues and brokers
      /broker.*host/i,
      /broker.*port/i,
      /queue.*host/i,
      /queue.*port/i,
      /kafka.*host/i,
      /kafka.*port/i,
      /redis.*host/i,
      /redis.*port/i,
      
      // Container and orchestration
      /container.*port/i,
      /docker.*port/i,
      /kubernetes.*port/i,
      /k8s.*port/i
    ];
    
    return criticalPatterns.some(pattern => pattern.test(path));
  }

  private static isSecurityPath(path: string): boolean {
    const securityPatterns = [
      /cors/i,
      /csrf/i,
      /xss/i,
      /permission/i,
      /role/i,
      /access/i,
      /encryption/i,
      /hash/i,
      /salt/i,
      /session/i,
      /cookie/i,
      /jwt/i,
      /oauth/i,
      /saml/i,
      /ldap/i,
      /firewall/i,
      /whitelist/i,
      /blacklist/i,
      /allowlist/i,
      /denylist/i
    ];
    
    return securityPatterns.some(pattern => pattern.test(path));
  }

  private static isPerformancePath(path: string): boolean {
    const performancePatterns = [
      /cache/i,
      /timeout/i,
      /pool/i,
      /connection/i,
      /thread/i,
      /memory/i,
      /cpu/i,
      /limit/i,
      /throttle/i,
      /rate/i,
      /buffer/i,
      /batch/i,
      /worker/i,
      /queue.*size/i,
      /max.*connections/i,
      /min.*connections/i,
      /keepalive/i,
      /retry/i,
      /backoff/i,
      /circuit.*breaker/i
    ];
    
    return performancePatterns.some(pattern => pattern.test(path));
  }

  private static isLargeValueChange(change: any): boolean {
    const oldStr = String(change.oldValue || '');
    const newStr = String(change.newValue || '');
    
    // Consider it a large change if the difference is significant
    const lengthDiff = Math.abs(oldStr.length - newStr.length);
    const avgLength = (oldStr.length + newStr.length) / 2;
    
    return lengthDiff > 50 || (avgLength > 0 && lengthDiff / avgLength > 0.5);
  }
}

export class DiffStatistics {
  /**
   * Calculates comprehensive statistics for a diff
   */
  static calculate(changes: any[], leftContent: string, rightContent: string) {
    const leftLines = leftContent.split('\n');
    const rightLines = rightContent.split('\n');
    
    const stats = {
      linesAdded: 0,
      linesRemoved: 0,
      linesChanged: 0,
      filesCompared: 2,
      totalCharacters: leftContent.length + rightContent.length,
      similarities: 0
    };
    
    // Count changes by type
    changes.forEach(change => {
      switch (change.type) {
        case 'added':
          stats.linesAdded++;
          break;
        case 'removed':
          stats.linesRemoved++;
          break;
        case 'changed':
          stats.linesChanged++;
          break;
      }
    });
    
    // Calculate similarity percentage
    const totalLines = Math.max(leftLines.length, rightLines.length);
    const changedLines = stats.linesAdded + stats.linesRemoved + stats.linesChanged;
    stats.similarities = totalLines > 0 ? ((totalLines - changedLines) / totalLines) * 100 : 100;
    
    return stats;
  }
}