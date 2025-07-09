export interface EnvironmentVariable {
  name: string;
  value: string;
  source: 'env' | 'default' | 'override';
  description?: string;
}

export interface VariableResolutionOptions {
  expandEnvironmentVariables?: boolean;
  customVariables?: Record<string, string>;
  defaultValues?: Record<string, string>;
  allowUndefined?: boolean;
  throwOnUndefined?: boolean;
  preserveOriginal?: boolean;
  resolveNested?: boolean;
  maxDepth?: number;
}

export interface VariableResolutionResult {
  expanded: string;
  variables: EnvironmentVariable[];
  errors: Array<{
    variable: string;
    error: string;
    line?: number;
    column?: number;
  }>;
  warnings: Array<{
    variable: string;
    warning: string;
    line?: number;
    column?: number;
  }>;
}

export class VariableResolver {
  private options: VariableResolutionOptions;
  private variables: Map<string, EnvironmentVariable>;
  private processedVariables: Set<string>;
  private depth: number;

  constructor(options: VariableResolutionOptions = {}) {
    this.options = {
      expandEnvironmentVariables: true,
      allowUndefined: false,
      throwOnUndefined: false,
      preserveOriginal: false,
      resolveNested: true,
      maxDepth: 10,
      ...options
    };
    this.variables = new Map();
    this.processedVariables = new Set();
    this.depth = 0;
    this.initializeVariables();
  }

  resolve(content: string): VariableResolutionResult {
    const errors: Array<{ variable: string; error: string; line?: number; column?: number }> = [];
    const warnings: Array<{ variable: string; warning: string; line?: number; column?: number }> = [];
    
    this.processedVariables.clear();
    this.depth = 0;

    let expanded = content;

    // Different variable syntax patterns
    const patterns = [
      // ${VAR} or ${VAR:-default}
      /\$\{([^}]+)\}/g,
      // $VAR (word boundary)
      /\$(\w+)/g,
      // #{VAR} (alternative syntax)
      /#\{([^}]+)\}/g,
      // {{VAR}} (template syntax)
      /\{\{([^}]+)\}\}/g
    ];

    for (const pattern of patterns) {
      expanded = expanded.replace(pattern, (match, varExpression) => {
        const result = this.resolveVariable(varExpression, match);
        
        if (result.error) {
          errors.push({
            variable: varExpression,
            error: result.error
          });
        }
        
        if (result.warning) {
          warnings.push({
            variable: varExpression,
            warning: result.warning
          });
        }

        return result.value;
      });
    }

    // Handle nested variable resolution
    if (this.options.resolveNested && this.depth < (this.options.maxDepth || 10)) {
      const nestedResult = this.resolveNested(expanded);
      if (nestedResult.hasChanges) {
        const recursiveResult = this.resolve(nestedResult.content);
        expanded = recursiveResult.expanded;
        errors.push(...recursiveResult.errors);
        warnings.push(...recursiveResult.warnings);
      }
    }

    return {
      expanded,
      variables: Array.from(this.variables.values()),
      errors,
      warnings
    };
  }

  private resolveVariable(expression: string, originalMatch: string): {
    value: string;
    error?: string;
    warning?: string;
  } {
    // Handle default values: VAR:-default or VAR:default
    const defaultMatch = expression.match(/^([^:]+)(:[-]?)(.*)$/);
    const varName = defaultMatch ? defaultMatch[1].trim() : expression.trim();
    const defaultValue = defaultMatch ? defaultMatch[3] : undefined;

    // Check for circular references
    if (this.processedVariables.has(varName)) {
      return {
        value: originalMatch,
        error: `Circular reference detected for variable: ${varName}`
      };
    }

    this.processedVariables.add(varName);

    let value: string | undefined;
    let source: 'env' | 'default' | 'override' = 'env';

    // Priority order: override -> environment -> default
    if (this.options.customVariables && varName in this.options.customVariables) {
      value = this.options.customVariables[varName];
      source = 'override';
    } else if (this.options.expandEnvironmentVariables && this.getEnvVar(varName)) {
      value = this.getEnvVar(varName);
      source = 'env';
    } else if (defaultValue !== undefined) {
      value = defaultValue;
      source = 'default';
    } else if (this.options.defaultValues && varName in this.options.defaultValues) {
      value = this.options.defaultValues[varName];
      source = 'default';
    }

    // Store variable info
    if (value !== undefined) {
      this.variables.set(varName, {
        name: varName,
        value,
        source
      });
    }

    // Handle undefined variables
    if (value === undefined) {
      if (this.options.throwOnUndefined) {
        throw new Error(`Undefined variable: ${varName}`);
      }

      if (this.options.allowUndefined) {
        return {
          value: originalMatch,
          warning: `Variable '${varName}' is undefined, keeping original`
        };
      }

      return {
        value: '',
        error: `Undefined variable: ${varName}`
      };
    }

    this.processedVariables.delete(varName);
    return { value };
  }

  private resolveNested(content: string): { content: string; hasChanges: boolean } {
    this.depth++;
    const originalContent = content;
    
    // Look for variables that might contain other variables
    const variablePattern = /\$\{([^}]+)\}/g;
    let hasChanges = false;
    
    const resolved = content.replace(variablePattern, (match, expression) => {
      const variable = this.variables.get(expression.trim());
      if (variable && variable.value.includes('${')) {
        hasChanges = true;
        return variable.value;
      }
      return match;
    });

    return {
      content: resolved,
      hasChanges: hasChanges || resolved !== originalContent
    };
  }

  private getEnvVar(name: string): string | undefined {
    // Browser environment - variables would need to be injected
    if (typeof window !== 'undefined') {
      return (window as any).ENV_VARS?.[name];
    }
    
    // Node.js environment
    if (typeof global !== 'undefined' && (global as any).process?.env) {
      return (global as any).process.env[name];
    }
    
    return undefined;
  }

  private initializeVariables(): void {
    // Initialize with common environment variables
    const commonVars = [
      'NODE_ENV',
      'PORT',
      'HOST',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'API_KEY',
      'SECRET_KEY',
      'DEBUG'
    ];

    for (const varName of commonVars) {
      const value = this.getEnvVar(varName);
      if (value) {
        this.variables.set(varName, {
          name: varName,
          value,
          source: 'env'
        });
      }
    }

    // Add custom variables
    if (this.options.customVariables) {
      for (const [varName, value] of Object.entries(this.options.customVariables)) {
        this.variables.set(varName, {
          name: varName,
          value,
          source: 'override'
        });
      }
    }

    // Add default values
    if (this.options.defaultValues) {
      for (const [varName, value] of Object.entries(this.options.defaultValues)) {
        if (!this.variables.has(varName)) {
          this.variables.set(varName, {
            name: varName,
            value,
            source: 'default'
          });
        }
      }
    }
  }

  getVariable(name: string): EnvironmentVariable | undefined {
    return this.variables.get(name);
  }

  getAllVariables(): EnvironmentVariable[] {
    return Array.from(this.variables.values());
  }

  setVariable(name: string, value: string, source: 'env' | 'default' | 'override' = 'override'): void {
    this.variables.set(name, {
      name,
      value,
      source
    });
  }

  removeVariable(name: string): boolean {
    return this.variables.delete(name);
  }

  clearVariables(): void {
    this.variables.clear();
  }
}

export function expandVariables(
  content: string,
  options: VariableResolutionOptions = {}
): VariableResolutionResult {
  const resolver = new VariableResolver(options);
  return resolver.resolve(content);
}

export function extractVariables(content: string): string[] {
  const variables = new Set<string>();
  
  // Different variable syntax patterns
  const patterns = [
    /\$\{([^}:]+)/g,  // ${VAR} or ${VAR:-default}
    /\$(\w+)/g,       // $VAR
    /#\{([^}]+)\}/g,  // #{VAR}
    /\{\{([^}]+)\}\}/g // {{VAR}}
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      variables.add(match[1].trim());
    }
  }

  return Array.from(variables);
}

export function validateVariables(
  content: string,
  availableVariables: Record<string, string>
): {
  valid: boolean;
  missing: string[];
  used: string[];
} {
  const usedVariables = extractVariables(content);
  const missing = usedVariables.filter(varName => !(varName in availableVariables));
  
  return {
    valid: missing.length === 0,
    missing,
    used: usedVariables
  };
}

export function compareVariableExpansion(
  leftContent: string,
  rightContent: string,
  options: VariableResolutionOptions = {}
): {
  left: VariableResolutionResult;
  right: VariableResolutionResult;
  variableChanges: Array<{
    name: string;
    leftValue?: string;
    rightValue?: string;
    type: 'added' | 'removed' | 'changed' | 'unchanged';
  }>;
} {
  const leftResult = expandVariables(leftContent, options);
  const rightResult = expandVariables(rightContent, options);

  // Compare variables
  const leftVars = new Map(leftResult.variables.map(v => [v.name, v.value]));
  const rightVars = new Map(rightResult.variables.map(v => [v.name, v.value]));
  
  const allVarNames = new Set([...leftVars.keys(), ...rightVars.keys()]);
  const variableChanges: Array<{
    name: string;
    leftValue?: string;
    rightValue?: string;
    type: 'added' | 'removed' | 'changed' | 'unchanged';
  }> = [];

  for (const varName of allVarNames) {
    const leftValue = leftVars.get(varName);
    const rightValue = rightVars.get(varName);

    if (leftValue === undefined && rightValue !== undefined) {
      variableChanges.push({
        name: varName,
        rightValue,
        type: 'added'
      });
    } else if (leftValue !== undefined && rightValue === undefined) {
      variableChanges.push({
        name: varName,
        leftValue,
        type: 'removed'
      });
    } else if (leftValue !== rightValue) {
      variableChanges.push({
        name: varName,
        leftValue,
        rightValue,
        type: 'changed'
      });
    } else {
      variableChanges.push({
        name: varName,
        leftValue,
        rightValue,
        type: 'unchanged'
      });
    }
  }

  return {
    left: leftResult,
    right: rightResult,
    variableChanges
  };
}

export function createVariableResolver(
  variables: Record<string, string>,
  options: Partial<VariableResolutionOptions> = {}
): VariableResolver {
  return new VariableResolver({
    customVariables: variables,
    ...options
  });
}

export function resolveConfigVariables(
  content: string,
  envVars: Record<string, string> = {},
  defaultVars: Record<string, string> = {}
): VariableResolutionResult {
  return expandVariables(content, {
    expandEnvironmentVariables: true,
    customVariables: envVars,
    defaultValues: defaultVars,
    allowUndefined: false,
    resolveNested: true,
    maxDepth: 5
  });
}

// Environment variable detection helpers
export function detectEnvironmentVariables(content: string): {
  variables: string[];
  patterns: Array<{
    pattern: string;
    matches: Array<{
      variable: string;
      match: string;
      index: number;
    }>;
  }>;
} {
  const variables = new Set<string>();
  const patterns: Array<{
    pattern: string;
    matches: Array<{
      variable: string;
      match: string;
      index: number;
    }>;
  }> = [];

  const syntaxPatterns = [
    { name: 'bash', regex: /\$\{([^}]+)\}/g, description: 'Bash-style ${VAR}' },
    { name: 'simple', regex: /\$(\w+)/g, description: 'Simple $VAR' },
    { name: 'hash', regex: /#\{([^}]+)\}/g, description: 'Hash-style #{VAR}' },
    { name: 'template', regex: /\{\{([^}]+)\}\}/g, description: 'Template-style {{VAR}}' }
  ];

  for (const { description, regex } of syntaxPatterns) {
    const matches: Array<{
      variable: string;
      match: string;
      index: number;
    }> = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim();
      variables.add(variable);
      matches.push({
        variable,
        match: match[0],
        index: match.index
      });
    }

    if (matches.length > 0) {
      patterns.push({
        pattern: description,
        matches
      });
    }
  }

  return {
    variables: Array.from(variables),
    patterns
  };
}

export function suggestVariableNames(content: string): string[] {
  const suggestions = new Set<string>();
  
  // Common patterns that might be variables
  const commonPatterns = [
    /([A-Z_][A-Z0-9_]*)/g,  // UPPERCASE_NAMES
    /(['"])(.*?)\1/g,        // Quoted strings
    /(\w+):\s*['"]([^'"]+)['"]/g  // Key-value pairs
  ];

  for (const pattern of commonPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const candidate = match[1] || match[2];
      if (candidate && candidate.length > 2 && /^[A-Z_]/.test(candidate)) {
        suggestions.add(candidate);
      }
    }
  }

  return Array.from(suggestions);
}