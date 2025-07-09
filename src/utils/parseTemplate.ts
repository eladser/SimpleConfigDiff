import { ConfigFormat } from '@/types';

export interface TemplateBlock {
  type: 'variable' | 'block' | 'comment' | 'text';
  content: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  name?: string;
  args?: string[];
  filters?: string[];
}

export interface TemplateParseResult {
  blocks: TemplateBlock[];
  variables: Record<string, any>;
  format: 'jinja2' | 'handlebars' | 'mustache';
  metadata: {
    templateEngine: string;
    version?: string;
    dependencies?: string[];
  };
}

export class TemplateParser {
  private content: string;
  private format: 'jinja2' | 'handlebars' | 'mustache';
  private lines: string[];
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(content: string, format: 'jinja2' | 'handlebars' | 'mustache') {
    this.content = content;
    this.format = format;
    this.lines = content.split('\n');
  }

  parse(): TemplateParseResult {
    const blocks: TemplateBlock[] = [];
    const variables: Record<string, any> = {};
    
    this.position = 0;
    this.line = 1;
    this.column = 1;

    while (this.position < this.content.length) {
      const block = this.parseNextBlock();
      if (block) {
        blocks.push(block);
        
        // Extract variables from blocks
        if (block.type === 'variable' && block.name) {
          variables[block.name] = null; // Placeholder value
        }
      }
    }

    return {
      blocks,
      variables,
      format: this.format,
      metadata: {
        templateEngine: this.format,
        version: this.detectVersion(),
        dependencies: this.extractDependencies(blocks)
      }
    };
  }

  private parseNextBlock(): TemplateBlock | null {
    const startLine = this.line;
    const startColumn = this.column;

    switch (this.format) {
      case 'jinja2':
        return this.parseJinja2Block(startLine, startColumn);
      case 'handlebars':
        return this.parseHandlebarsBlock(startLine, startColumn);
      case 'mustache':
        return this.parseMustacheBlock(startLine, startColumn);
      default:
        return null;
    }
  }

  private parseJinja2Block(startLine: number, startColumn: number): TemplateBlock | null {
    const current = this.peek();
    
    // Variable blocks: {{ variable }}
    if (current === '{' && this.peek(1) === '{') {
      return this.parseJinja2Variable(startLine, startColumn);
    }
    
    // Block statements: {% block %} {% endblock %}
    if (current === '{' && this.peek(1) === '%') {
      return this.parseJinja2BlockStatement(startLine, startColumn);
    }
    
    // Comments: {# comment #}
    if (current === '{' && this.peek(1) === '#') {
      return this.parseJinja2Comment(startLine, startColumn);
    }
    
    // Text content
    return this.parseTextUntilTemplate(startLine, startColumn);
  }

  private parseJinja2Variable(startLine: number, startColumn: number): TemplateBlock {
    this.advance(2); // Skip '{{'
    
    const content = this.readUntil('}}');
    this.advance(2); // Skip '}}'
    
    const trimmedContent = content.trim();
    const parts = trimmedContent.split('|');
    const variableName = parts[0].trim();
    const filters = parts.slice(1).map(f => f.trim());
    
    return {
      type: 'variable',
      content: `{{${content}}}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column,
      name: variableName,
      filters
    };
  }

  private parseJinja2BlockStatement(startLine: number, startColumn: number): TemplateBlock {
    this.advance(2); // Skip '{%'
    
    const content = this.readUntil('%}');
    this.advance(2); // Skip '%}'
    
    const trimmedContent = content.trim();
    const parts = trimmedContent.split(/\s+/);
    const blockName = parts[0];
    const args = parts.slice(1);
    
    return {
      type: 'block',
      content: `{%${content}%}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column,
      name: blockName,
      args
    };
  }

  private parseJinja2Comment(startLine: number, startColumn: number): TemplateBlock {
    this.advance(2); // Skip '{#'
    
    const content = this.readUntil('#}');
    this.advance(2); // Skip '#}'
    
    return {
      type: 'comment',
      content: `{#${content}#}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column
    };
  }

  private parseHandlebarsBlock(startLine: number, startColumn: number): TemplateBlock | null {
    const current = this.peek();
    
    // Variable blocks: {{ variable }} or {{{ variable }}}
    if (current === '{' && this.peek(1) === '{') {
      return this.parseHandlebarsVariable(startLine, startColumn);
    }
    
    // Comments: {{! comment }} or {{!-- comment --}}
    if (current === '{' && this.peek(1) === '{' && this.peek(2) === '!') {
      return this.parseHandlebarsComment(startLine, startColumn);
    }
    
    // Text content
    return this.parseTextUntilTemplate(startLine, startColumn);
  }

  private parseHandlebarsVariable(startLine: number, startColumn: number): TemplateBlock {
    let isTriple = false;
    
    this.advance(2); // Skip '{{'
    
    if (this.peek() === '{') {
      isTriple = true;
      this.advance(1); // Skip third '{'
    }
    
    const endPattern = isTriple ? '}}}' : '}}';
    const content = this.readUntil(endPattern);
    this.advance(endPattern.length);
    
    const trimmedContent = content.trim();
    const parts = trimmedContent.split(/\s+/);
    const variableName = parts[0];
    const args = parts.slice(1);
    
    return {
      type: 'variable',
      content: `{{${isTriple ? '{' : ''}${content}${isTriple ? '}' : ''}}}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column,
      name: variableName,
      args
    };
  }

  private parseHandlebarsComment(startLine: number, startColumn: number): TemplateBlock {
    this.advance(2); // Skip '{{'
    
    let content: string;
    let endPattern: string;
    
    if (this.peek() === '!' && this.peek(1) === '-' && this.peek(2) === '-') {
      this.advance(3); // Skip '!--'
      endPattern = '--}}';
      content = this.readUntil(endPattern);
    } else {
      this.advance(1); // Skip '!'
      endPattern = '}}';
      content = this.readUntil(endPattern);
    }
    
    this.advance(endPattern.length);
    
    return {
      type: 'comment',
      content: `{{!${content}}}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column
    };
  }

  private parseMustacheBlock(startLine: number, startColumn: number): TemplateBlock | null {
    const current = this.peek();
    
    // Variable blocks: {{ variable }} or {{{ variable }}}
    if (current === '{' && this.peek(1) === '{') {
      return this.parseMustacheVariable(startLine, startColumn);
    }
    
    // Text content
    return this.parseTextUntilTemplate(startLine, startColumn);
  }

  private parseMustacheVariable(startLine: number, startColumn: number): TemplateBlock {
    let isTriple = false;
    
    this.advance(2); // Skip '{{'
    
    if (this.peek() === '{') {
      isTriple = true;
      this.advance(1); // Skip third '{'
    }
    
    const endPattern = isTriple ? '}}}' : '}}';
    const content = this.readUntil(endPattern);
    this.advance(endPattern.length);
    
    const trimmedContent = content.trim();
    let variableName = trimmedContent;
    
    // Handle sections and inverted sections
    if (trimmedContent.startsWith('#') || trimmedContent.startsWith('^')) {
      variableName = trimmedContent.substring(1);
    } else if (trimmedContent.startsWith('/')) {
      variableName = trimmedContent.substring(1);
    }
    
    return {
      type: 'variable',
      content: `{{${isTriple ? '{' : ''}${content}${isTriple ? '}' : ''}}}`,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column,
      name: variableName
    };
  }

  private parseTextUntilTemplate(startLine: number, startColumn: number): TemplateBlock {
    let content = '';
    
    while (this.position < this.content.length) {
      const current = this.peek();
      
      // Check for template start
      if (current === '{' && this.isTemplateStart()) {
        break;
      }
      
      content += current;
      this.advance();
    }
    
    return {
      type: 'text',
      content,
      startLine,
      endLine: this.line,
      startColumn,
      endColumn: this.column
    };
  }

  private isTemplateStart(): boolean {
    const next = this.peek(1);
    
    switch (this.format) {
      case 'jinja2':
        return next === '{' || next === '%' || next === '#';
      case 'handlebars':
        return next === '{';
      case 'mustache':
        return next === '{';
      default:
        return false;
    }
  }

  private readUntil(delimiter: string): string {
    let content = '';
    
    while (this.position < this.content.length) {
      if (this.content.substring(this.position, this.position + delimiter.length) === delimiter) {
        break;
      }
      
      content += this.content[this.position];
      this.advance();
    }
    
    return content;
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.content.length ? this.content[pos] : '';
  }

  private advance(count: number = 1): void {
    for (let i = 0; i < count && this.position < this.content.length; i++) {
      if (this.content[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private detectVersion(): string {
    // Simple version detection based on syntax features
    const hasJinja2Features = this.content.includes('|') || this.content.includes('{%');
    const hasHandlebarsFeatures = this.content.includes('{{#') || this.content.includes('{{!');
    
    if (hasJinja2Features && this.format === 'jinja2') {
      return '2.x';
    } else if (hasHandlebarsFeatures && this.format === 'handlebars') {
      return '4.x';
    } else if (this.format === 'mustache') {
      return '3.x';
    }
    
    return 'unknown';
  }

  private extractDependencies(blocks: TemplateBlock[]): string[] {
    const dependencies: Set<string> = new Set();
    
    for (const block of blocks) {
      if (block.type === 'block' && block.name) {
        // Extract common template dependencies
        if (block.name === 'include' || block.name === 'extends') {
          const templateName = block.args?.[0]?.replace(/['"]/g, '');
          if (templateName) {
            dependencies.add(templateName);
          }
        }
      }
    }
    
    return Array.from(dependencies);
  }
}

export function parseTemplate(content: string, filename: string): TemplateParseResult | null {
  const format = detectTemplateFormat(content, filename);
  
  if (!format) {
    return null;
  }
  
  const parser = new TemplateParser(content, format);
  return parser.parse();
}

export function detectTemplateFormat(content: string, filename: string): 'jinja2' | 'handlebars' | 'mustache' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // File extension-based detection
  if (ext === 'j2' || ext === 'jinja' || ext === 'jinja2') {
    return 'jinja2';
  }
  
  if (ext === 'hbs' || ext === 'handlebars') {
    return 'handlebars';
  }
  
  if (ext === 'mustache') {
    return 'mustache';
  }
  
  // Content-based detection
  if (content.includes('{%') || content.includes('{#') || content.includes('|')) {
    return 'jinja2';
  }
  
  if (content.includes('{{#') || content.includes('{{!') || content.includes('{{>')) {
    return 'handlebars';
  }
  
  if (content.includes('{{') && content.includes('}}')) {
    return 'mustache';
  }
  
  return null;
}

export function compareTemplates(
  leftResult: TemplateParseResult, 
  rightResult: TemplateParseResult
): {
  variableChanges: Array<{
    name: string;
    leftValue: any;
    rightValue: any;
    type: 'added' | 'removed' | 'changed';
  }>;
  blockChanges: Array<{
    name: string;
    leftBlock?: TemplateBlock;
    rightBlock?: TemplateBlock;
    type: 'added' | 'removed' | 'changed';
  }>;
  formatMismatch: boolean;
} {
  const variableChanges: Array<{
    name: string;
    leftValue: any;
    rightValue: any;
    type: 'added' | 'removed' | 'changed';
  }> = [];
  
  const blockChanges: Array<{
    name: string;
    leftBlock?: TemplateBlock;
    rightBlock?: TemplateBlock;
    type: 'added' | 'removed' | 'changed';
  }> = [];
  
  const formatMismatch = leftResult.format !== rightResult.format;
  
  // Compare variables
  const leftVars = new Set(Object.keys(leftResult.variables));
  const rightVars = new Set(Object.keys(rightResult.variables));
  
  // Added variables
  for (const varName of rightVars) {
    if (!leftVars.has(varName)) {
      variableChanges.push({
        name: varName,
        leftValue: undefined,
        rightValue: rightResult.variables[varName],
        type: 'added'
      });
    }
  }
  
  // Removed variables
  for (const varName of leftVars) {
    if (!rightVars.has(varName)) {
      variableChanges.push({
        name: varName,
        leftValue: leftResult.variables[varName],
        rightValue: undefined,
        type: 'removed'
      });
    }
  }
  
  // Changed variables
  for (const varName of leftVars) {
    if (rightVars.has(varName)) {
      const leftValue = leftResult.variables[varName];
      const rightValue = rightResult.variables[varName];
      
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        variableChanges.push({
          name: varName,
          leftValue,
          rightValue,
          type: 'changed'
        });
      }
    }
  }
  
  // Compare blocks
  const leftBlocks = leftResult.blocks.filter(b => b.type === 'block');
  const rightBlocks = rightResult.blocks.filter(b => b.type === 'block');
  
  const leftBlockMap = new Map(leftBlocks.map(b => [b.name || '', b]));
  const rightBlockMap = new Map(rightBlocks.map(b => [b.name || '', b]));
  
  // Added blocks
  for (const [name, block] of rightBlockMap) {
    if (!leftBlockMap.has(name)) {
      blockChanges.push({
        name,
        rightBlock: block,
        type: 'added'
      });
    }
  }
  
  // Removed blocks
  for (const [name, block] of leftBlockMap) {
    if (!rightBlockMap.has(name)) {
      blockChanges.push({
        name,
        leftBlock: block,
        type: 'removed'
      });
    }
  }
  
  // Changed blocks
  for (const [name, leftBlock] of leftBlockMap) {
    const rightBlock = rightBlockMap.get(name);
    if (rightBlock && leftBlock.content !== rightBlock.content) {
      blockChanges.push({
        name,
        leftBlock,
        rightBlock,
        type: 'changed'
      });
    }
  }
  
  return {
    variableChanges,
    blockChanges,
    formatMismatch
  };
}

export function expandTemplateVariables(
  content: string, 
  variables: Record<string, any>
): string {
  let expanded = content;
  
  // Simple variable expansion (this is a basic implementation)
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    expanded = expanded.replace(regex, String(value || ''));
  }
  
  return expanded;
}