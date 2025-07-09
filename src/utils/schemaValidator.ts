import { ConfigFormat } from '@/types';

export interface SchemaValidationResult {
  isValid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationWarning[];
  schemaVersion?: string;
  validatedAgainst?: string;
}

export interface SchemaValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
  expectedType?: string;
  actualType?: string;
  expectedValue?: any;
  actualValue?: any;
  line?: number;
  column?: number;
}

export interface SchemaValidationWarning {
  path: string;
  message: string;
  code: string;
  suggestion?: string;
  line?: number;
  column?: number;
}

export interface SchemaValidatorOptions {
  strictMode?: boolean;
  allowAdditionalProperties?: boolean;
  validateFormat?: boolean;
  customFormats?: Record<string, (value: any) => boolean>;
  draft?: 'draft-04' | 'draft-06' | 'draft-07' | 'draft-2019-09' | 'draft-2020-12';
}

export class SchemaValidator {
  private schema: any;
  private options: SchemaValidatorOptions;
  private draft: string;

  constructor(schema: any, options: SchemaValidatorOptions = {}) {
    this.schema = schema;
    this.options = {
      strictMode: false,
      allowAdditionalProperties: true,
      validateFormat: true,
      draft: 'draft-07',
      ...options
    };
    this.draft = this.options.draft || 'draft-07';
  }

  validate(data: any): SchemaValidationResult {
    const errors: SchemaValidationError[] = [];
    const warnings: SchemaValidationWarning[] = [];

    try {
      this.validateRecursive(data, this.schema, '', errors, warnings);
    } catch (error) {
      errors.push({
        path: '',
        message: `Schema validation failed: ${error.message}`,
        severity: 'error',
        code: 'VALIDATION_ERROR'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      schemaVersion: this.schema.$schema || this.draft,
      validatedAgainst: this.schema.title || 'Unknown Schema'
    };
  }

  private validateRecursive(
    data: any,
    schema: any,
    path: string,
    errors: SchemaValidationError[],
    warnings: SchemaValidationWarning[]
  ): void {
    if (!schema) return;

    // Type validation
    if (schema.type && !this.validateType(data, schema.type)) {
      errors.push({
        path,
        message: `Expected type '${schema.type}' but got '${typeof data}'`,
        severity: 'error',
        code: 'TYPE_MISMATCH',
        expectedType: schema.type,
        actualType: typeof data,
        actualValue: data
      });
      return;
    }

    // Required properties validation
    if (schema.required && typeof data === 'object' && data !== null) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          errors.push({
            path: path ? `${path}.${requiredProp}` : requiredProp,
            message: `Missing required property: ${requiredProp}`,
            severity: 'error',
            code: 'MISSING_REQUIRED_PROPERTY'
          });
        }
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        severity: 'error',
        code: 'ENUM_MISMATCH',
        expectedValue: schema.enum,
        actualValue: data
      });
    }

    // Const validation
    if (schema.const !== undefined && data !== schema.const) {
      errors.push({
        path,
        message: `Value must be exactly: ${JSON.stringify(schema.const)}`,
        severity: 'error',
        code: 'CONST_MISMATCH',
        expectedValue: schema.const,
        actualValue: data
      });
    }

    // Format validation
    if (schema.format && this.options.validateFormat && typeof data === 'string') {
      if (!this.validateFormat(data, schema.format)) {
        errors.push({
          path,
          message: `String does not match format: ${schema.format}`,
          severity: 'error',
          code: 'FORMAT_MISMATCH',
          expectedType: schema.format,
          actualValue: data
        });
      }
    }

    // String-specific validations
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({
          path,
          message: `String length ${data.length} is less than minimum ${schema.minLength}`,
          severity: 'error',
          code: 'MIN_LENGTH_VIOLATION',
          actualValue: data.length,
          expectedValue: schema.minLength
        });
      }

      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({
          path,
          message: `String length ${data.length} exceeds maximum ${schema.maxLength}`,
          severity: 'error',
          code: 'MAX_LENGTH_VIOLATION',
          actualValue: data.length,
          expectedValue: schema.maxLength
        });
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          path,
          message: `String does not match pattern: ${schema.pattern}`,
          severity: 'error',
          code: 'PATTERN_MISMATCH',
          expectedValue: schema.pattern,
          actualValue: data
        });
      }
    }

    // Number-specific validations
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path,
          message: `Number ${data} is less than minimum ${schema.minimum}`,
          severity: 'error',
          code: 'MINIMUM_VIOLATION',
          actualValue: data,
          expectedValue: schema.minimum
        });
      }

      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path,
          message: `Number ${data} exceeds maximum ${schema.maximum}`,
          severity: 'error',
          code: 'MAXIMUM_VIOLATION',
          actualValue: data,
          expectedValue: schema.maximum
        });
      }

      if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
        errors.push({
          path,
          message: `Number ${data} is not greater than ${schema.exclusiveMinimum}`,
          severity: 'error',
          code: 'EXCLUSIVE_MINIMUM_VIOLATION',
          actualValue: data,
          expectedValue: schema.exclusiveMinimum
        });
      }

      if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
        errors.push({
          path,
          message: `Number ${data} is not less than ${schema.exclusiveMaximum}`,
          severity: 'error',
          code: 'EXCLUSIVE_MAXIMUM_VIOLATION',
          actualValue: data,
          expectedValue: schema.exclusiveMaximum
        });
      }

      if (schema.multipleOf !== undefined && data % schema.multipleOf !== 0) {
        errors.push({
          path,
          message: `Number ${data} is not a multiple of ${schema.multipleOf}`,
          severity: 'error',
          code: 'MULTIPLE_OF_VIOLATION',
          actualValue: data,
          expectedValue: schema.multipleOf
        });
      }
    }

    // Array-specific validations
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        errors.push({
          path,
          message: `Array length ${data.length} is less than minimum ${schema.minItems}`,
          severity: 'error',
          code: 'MIN_ITEMS_VIOLATION',
          actualValue: data.length,
          expectedValue: schema.minItems
        });
      }

      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        errors.push({
          path,
          message: `Array length ${data.length} exceeds maximum ${schema.maxItems}`,
          severity: 'error',
          code: 'MAX_ITEMS_VIOLATION',
          actualValue: data.length,
          expectedValue: schema.maxItems
        });
      }

      if (schema.uniqueItems && !this.areItemsUnique(data)) {
        errors.push({
          path,
          message: 'Array items must be unique',
          severity: 'error',
          code: 'UNIQUE_ITEMS_VIOLATION'
        });
      }

      // Validate array items
      if (schema.items) {
        data.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          if (Array.isArray(schema.items)) {
            const itemSchema = schema.items[index];
            if (itemSchema) {
              this.validateRecursive(item, itemSchema, itemPath, errors, warnings);
            }
          } else {
            this.validateRecursive(item, schema.items, itemPath, errors, warnings);
          }
        });
      }
    }

    // Object-specific validations
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) {
        errors.push({
          path,
          message: `Object has ${Object.keys(data).length} properties, minimum is ${schema.minProperties}`,
          severity: 'error',
          code: 'MIN_PROPERTIES_VIOLATION',
          actualValue: Object.keys(data).length,
          expectedValue: schema.minProperties
        });
      }

      if (schema.maxProperties !== undefined && Object.keys(data).length > schema.maxProperties) {
        errors.push({
          path,
          message: `Object has ${Object.keys(data).length} properties, maximum is ${schema.maxProperties}`,
          severity: 'error',
          code: 'MAX_PROPERTIES_VIOLATION',
          actualValue: Object.keys(data).length,
          expectedValue: schema.maxProperties
        });
      }

      // Validate object properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(data)) {
          const propertyPath = path ? `${path}.${key}` : key;
          const propertySchema = schema.properties[key];
          
          if (propertySchema) {
            this.validateRecursive(value, propertySchema, propertyPath, errors, warnings);
          } else if (!this.options.allowAdditionalProperties && !schema.additionalProperties) {
            if (this.options.strictMode) {
              errors.push({
                path: propertyPath,
                message: `Additional property '${key}' is not allowed`,
                severity: 'error',
                code: 'ADDITIONAL_PROPERTY_NOT_ALLOWED'
              });
            } else {
              warnings.push({
                path: propertyPath,
                message: `Additional property '${key}' found`,
                code: 'ADDITIONAL_PROPERTY_FOUND',
                suggestion: 'Consider adding this property to the schema'
              });
            }
          }
        }
      }

      // Validate additional properties
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const [key, value] of Object.entries(data)) {
          if (!schema.properties || !schema.properties[key]) {
            const propertyPath = path ? `${path}.${key}` : key;
            this.validateRecursive(value, schema.additionalProperties, propertyPath, errors, warnings);
          }
        }
      }
    }

    // Conditional validations
    if (schema.if) {
      const conditionResult = this.validateCondition(data, schema.if);
      if (conditionResult) {
        if (schema.then) {
          this.validateRecursive(data, schema.then, path, errors, warnings);
        }
      } else {
        if (schema.else) {
          this.validateRecursive(data, schema.else, path, errors, warnings);
        }
      }
    }

    // anyOf, oneOf, allOf validations
    if (schema.anyOf) {
      const anyOfErrors: SchemaValidationError[] = [];
      let anyOfValid = false;

      for (const subSchema of schema.anyOf) {
        const subErrors: SchemaValidationError[] = [];
        const subWarnings: SchemaValidationWarning[] = [];
        this.validateRecursive(data, subSchema, path, subErrors, subWarnings);
        
        if (subErrors.length === 0) {
          anyOfValid = true;
          break;
        }
        anyOfErrors.push(...subErrors);
      }

      if (!anyOfValid) {
        errors.push({
          path,
          message: 'Data does not match any of the expected schemas',
          severity: 'error',
          code: 'ANY_OF_VIOLATION'
        });
      }
    }

    if (schema.oneOf) {
      const oneOfResults = schema.oneOf.map(subSchema => {
        const subErrors: SchemaValidationError[] = [];
        const subWarnings: SchemaValidationWarning[] = [];
        this.validateRecursive(data, subSchema, path, subErrors, subWarnings);
        return subErrors.length === 0;
      });

      const validCount = oneOfResults.filter(valid => valid).length;
      if (validCount !== 1) {
        errors.push({
          path,
          message: `Data must match exactly one schema, but matches ${validCount}`,
          severity: 'error',
          code: 'ONE_OF_VIOLATION'
        });
      }
    }

    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        this.validateRecursive(data, subSchema, path, errors, warnings);
      }
    }

    if (schema.not) {
      const notErrors: SchemaValidationError[] = [];
      const notWarnings: SchemaValidationWarning[] = [];
      this.validateRecursive(data, schema.not, path, notErrors, notWarnings);
      
      if (notErrors.length === 0) {
        errors.push({
          path,
          message: 'Data must not match the specified schema',
          severity: 'error',
          code: 'NOT_VIOLATION'
        });
      }
    }
  }

  private validateType(data: any, expectedType: string | string[]): boolean {
    const actualType = this.getJsonType(data);
    
    if (Array.isArray(expectedType)) {
      return expectedType.includes(actualType);
    }
    
    return actualType === expectedType;
  }

  private getJsonType(data: any): string {
    if (data === null) return 'null';
    if (Array.isArray(data)) return 'array';
    if (typeof data === 'number') {
      return Number.isInteger(data) ? 'integer' : 'number';
    }
    return typeof data;
  }

  private validateFormat(value: string, format: string): boolean {
    const formatValidators: Record<string, (value: string) => boolean> = {
      'date-time': (v) => !isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v),
      'date': (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)),
      'time': (v) => /^\d{2}:\d{2}:\d{2}$/.test(v),
      'email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'hostname': (v) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(v),
      'ipv4': (v) => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v),
      'ipv6': (v) => /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v),
      'uri': (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      'uuid': (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
    };

    const validator = formatValidators[format] || this.options.customFormats?.[format];
    return validator ? validator(value) : true;
  }

  private validateCondition(data: any, condition: any): boolean {
    const errors: SchemaValidationError[] = [];
    const warnings: SchemaValidationWarning[] = [];
    this.validateRecursive(data, condition, '', errors, warnings);
    return errors.length === 0;
  }

  private areItemsUnique(items: any[]): boolean {
    const seen = new Set();
    for (const item of items) {
      const key = typeof item === 'object' ? JSON.stringify(item) : item;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
    return true;
  }
}

export function validateWithSchema(
  data: any,
  schema: any,
  options: SchemaValidatorOptions = {}
): SchemaValidationResult {
  const validator = new SchemaValidator(schema, options);
  return validator.validate(data);
}

export function validateConfigWithSchema(
  content: string,
  schema: any,
  format: ConfigFormat,
  options: SchemaValidatorOptions = {}
): SchemaValidationResult {
  try {
    let data: any;
    
    switch (format) {
      case 'json':
        data = JSON.parse(content);
        break;
      case 'yaml':
        // This would require a YAML parser - simplified for now
        data = JSON.parse(content);
        break;
      default:
        return {
          isValid: false,
          errors: [{
            path: '',
            message: `Schema validation not supported for format: ${format}`,
            severity: 'error',
            code: 'UNSUPPORTED_FORMAT'
          }],
          warnings: []
        };
    }
    
    return validateWithSchema(data, schema, options);
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        path: '',
        message: `Failed to parse content: ${error.message}`,
        severity: 'error',
        code: 'PARSE_ERROR'
      }],
      warnings: []
    };
  }
}

export function generateSchemaFromData(data: any, options: { includeExamples?: boolean } = {}): any {
  const schema: any = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: getSchemaType(data)
  };

  if (options.includeExamples) {
    schema.examples = [data];
  }

  switch (schema.type) {
    case 'object':
      if (data && typeof data === 'object') {
        schema.properties = {};
        schema.required = [];
        
        for (const [key, value] of Object.entries(data)) {
          schema.properties[key] = generateSchemaFromData(value, options);
          schema.required.push(key);
        }
      }
      break;
      
    case 'array':
      if (Array.isArray(data) && data.length > 0) {
        schema.items = generateSchemaFromData(data[0], options);
      }
      break;
      
    case 'string':
      if (typeof data === 'string') {
        schema.minLength = 1;
        
        // Try to detect format
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
          schema.format = 'email';
        } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
          schema.format = 'date-time';
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          schema.format = 'date';
        }
      }
      break;
      
    case 'number':
    case 'integer':
      if (typeof data === 'number') {
        schema.minimum = data;
        schema.maximum = data;
      }
      break;
  }

  return schema;
}

function getSchemaType(data: any): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  if (typeof data === 'number') {
    return Number.isInteger(data) ? 'integer' : 'number';
  }
  return typeof data;
}