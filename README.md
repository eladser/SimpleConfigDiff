# SimpleConfigDiff

A powerful, browser-based tool that compares configuration files (JSON, YAML, XML, INI, TOML, ENV) and outputs human-friendly structured diffs with advanced analysis capabilities.

## ✨ Features

### 🔍 **Advanced Comparison Engine**
- **Semantic Comparison**: Understands that `"true"` and `true` are equivalent
- **Path-based Rules**: Ignore specific paths like `*.timestamp` or `database.*.password`
- **Value Transformations**: Custom regex rules to normalize values before comparison
- **Regex Pattern Matching**: Ignore keys matching patterns like `/^temp_/`
- **Smart Severity Analysis**: Automatically categorizes changes as critical, major, minor, or cosmetic

### 🎨 **Multiple Diff Views**
- **Tree View**: Hierarchical display of differences (default)
- **Side-by-Side View**: Split screen showing both files with highlighted differences
- **Unified Diff**: Git-style unified diff output with context lines
- **Syntax Highlighting**: Color-coded based on file format
- **Minimap**: Visual overview of where changes are located

### 📊 **Smart Analysis**
- **Impact Assessment**: Highlights critical vs. cosmetic changes
- **Security Analysis**: Flags potential security implications
- **Performance Impact**: Identifies changes that might affect performance
- **Change Statistics**: Comprehensive metrics including similarity percentage

### 🔧 **Supported Formats**
- **JSON** - JavaScript Object Notation
- **YAML** - YAML Ain't Markup Language
- **XML** - eXtensible Markup Language
- **INI** - Configuration files
- **TOML** - Tom's Obvious, Minimal Language
- **ENV** - Environment variable files
- **Config** - Generic configuration files

### 🌙 **Modern UI/UX**
- **Dark Mode**: Beautiful dark theme as default with light mode toggle
- **Responsive Design**: Works perfectly on desktop and mobile
- **Accessibility**: WCAG compliant with keyboard navigation
- **Theme Persistence**: Remembers your preferred theme

### 🔍 **Advanced Search & Filter**
- **Search Within Diffs**: Find specific changes
- **Filter by Change Type**: Show only additions/deletions/modifications
- **Filter by Severity**: Focus on critical, major, minor, or cosmetic changes
- **Filter by Category**: Security, performance, configuration, or structure changes
- **Path Pattern Matching**: Filter by specific configuration paths

### 📈 **Export & Integration**
- **JSON Export**: Export comparison results and settings
- **Unified Diff Export**: Generate patch files
- **Statistics Export**: Detailed analysis metrics
- **Shareable Results**: Export for team collaboration

## 🚀 Quick Start

1. **Upload Files**: Drag and drop or click to upload two configuration files
2. **Configure Options**: Use the advanced options panel to customize comparison behavior
3. **Compare**: Click the "Compare Files" button to analyze differences
4. **Explore**: Use different view modes and filters to analyze results
5. **Export**: Save results for documentation or sharing

## 📋 Advanced Options

### **Basic Options**
- **Case Sensitive**: Consider case when comparing strings
- **Sort Keys**: Sort object keys before comparison
- **Flatten Keys**: Convert nested objects to dot notation
- **Semantic Comparison**: Intelligent value equivalence
- **Ignore Whitespace**: Ignore whitespace differences
- **Ignore Comments**: Skip comment changes

### **Path Rules**
Create custom rules to handle specific paths:
- **Glob Patterns**: `*.timestamp`, `database.*.password`
- **Regex Patterns**: `/^temp_/`, `/.*\.log$/`
- **Exact Matches**: `config.debug`, `server.port`

### **Value Transformations**
Transform values before comparison:
- **URL Normalization**: Convert `https://` to `http://`
- **Whitespace Cleanup**: Normalize multiple spaces
- **Case Normalization**: Convert to lowercase
- **Custom Regex**: Any regex pattern and replacement

### **Display Options**
- **Diff Mode**: Tree, Side-by-Side, or Unified
- **Context Lines**: Number of context lines in unified diff
- **Line Numbers**: Show/hide line numbers
- **Minimap**: Visual overview of changes

## 🔧 Technical Implementation

### **Core Technologies**
- **React 18** with TypeScript for type safety
- **Tailwind CSS** for styling with dark mode support
- **Vite** for fast development and building
- **Lucide Icons** for beautiful iconography

### **Advanced Features**
- **Semantic Analysis**: Intelligent value comparison
- **Performance Optimized**: Efficient diff algorithms
- **Memory Efficient**: Handles large configuration files
- **Error Handling**: Robust error reporting and recovery

### **Comparison Algorithm**
- **Multi-pass Analysis**: Structural, semantic, and value-level comparison
- **Change Classification**: Automatic severity and category detection
- **Path-aware Processing**: Respects configuration structure
- **Transformation Pipeline**: Pre-processing with custom rules

## 📚 Use Cases

### **Development Teams**
- Compare configuration files between environments
- Review configuration changes in pull requests
- Identify breaking changes in deployments
- Validate configuration migrations

### **DevOps Engineers**
- Compare Kubernetes manifests
- Analyze Docker Compose changes
- Review infrastructure configurations
- Validate deployment configurations

### **Security Teams**
- Identify security-sensitive configuration changes
- Review access control modifications
- Audit configuration compliance
- Track security parameter changes

### **System Administrators**
- Compare server configurations
- Analyze application settings
- Review database configurations
- Validate system updates

## 🎯 Comparison Examples

### **Semantic Comparison**
```json
// File A
{
  "debug": "true",
  "port": "8080",
  "enabled": 1
}

// File B
{
  "debug": true,
  "port": 8080,
  "enabled": "yes"
}
```
With semantic comparison enabled, these files are considered equivalent!

### **Path Rules**
```yaml
# Ignore all timestamp fields
*.timestamp: ignore

# Ignore all password fields
*.password: ignore

# Ignore temporary files
/^temp_/: ignore
```

### **Value Transformations**
```yaml
# Normalize URLs
https?:// → http://

# Normalize whitespace
\s+ → (single space)

# Convert to lowercase
[A-Z] → [a-z]
```

## 🔒 Security & Privacy

- **Client-side Only**: All processing happens in your browser
- **No Data Upload**: Files never leave your device
- **No Tracking**: No analytics or user tracking
- **Open Source**: Fully transparent and auditable code

## 🚀 Performance

- **Optimized Algorithms**: Efficient diff computation
- **Memory Management**: Handles large files gracefully
- **Responsive UI**: Smooth interactions even with complex diffs
- **Progressive Loading**: Renders results as they're computed

## 📱 Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile**: Responsive design works on all devices

## 🛠️ Development

### **Local Development**
```bash
npm install
npm run dev
```

### **Build for Production**
```bash
npm run build
```

### **Type Checking**
```bash
npm run type-check
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🌟 Star History

If you find this tool useful, please consider giving it a star on GitHub!

---

**Built with ❤️ for developers, by developers**