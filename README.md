# SimpleConfigDiff

A fast, browser-based tool for comparing configuration files with intelligent semantic analysis.

## 🚀 Features

- **Multiple Format Support**: JSON, YAML, XML, INI, TOML, ENV, Properties, Config, HCL, CSV, and template files
- **Semantic Comparison**: Understands that `"true"` and `true` are equivalent
- **Smart Diff Views**: Side-by-side, tree, and unified diff modes
- **Real-time Processing**: All comparison happens in your browser - no data leaves your device
- **Dark Mode**: Beautiful dark theme with light mode toggle
- **Export Options**: JSON, CSV, HTML, and patch file exports

## 🔧 Quick Start

### Online Version
Visit [https://eladser.github.io/SimpleConfigDiff/](https://eladser.github.io/SimpleConfigDiff/)

### Local Development
```bash
# Clone the repository
git clone https://github.com/eladser/SimpleConfigDiff.git
cd SimpleConfigDiff

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🎯 Usage

1. **Upload Files**: Drag and drop or click to select two configuration files
2. **Paste Text**: Alternatively, paste configuration text directly
3. **Compare**: Click "Compare" to analyze differences
4. **Explore**: Use filters and search to focus on specific changes
5. **Export**: Save results in various formats

## 🔍 Comparison Modes

### Side-by-Side View
- **Semantic Mode**: Shows configuration differences by key/value pairs
- **Raw Mode**: Traditional line-by-line comparison
- Automatically switches to semantic mode for different file formats

### Tree View
- Hierarchical display of configuration changes
- Expandable/collapsible sections
- Color-coded change indicators

### Unified Diff
- Git-style unified diff output
- Configurable context lines
- Suitable for patch generation

## 📊 Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| JSON | `.json` | JavaScript Object Notation |
| YAML | `.yaml`, `.yml` | YAML Ain't Markup Language |
| XML | `.xml` | eXtensible Markup Language |
| INI | `.ini` | Configuration files |
| TOML | `.toml` | Tom's Obvious Minimal Language |
| ENV | `.env` | Environment variables |
| Properties | `.properties` | Java properties files |
| Config | `.config`, `.conf` | Generic configuration |
| HCL | `.hcl` | HashiCorp Configuration Language |
| CSV | `.csv` | Comma-separated values |
| Templates | `.j2`, `.hbs`, `.mustache` | Template files |

## 🛠️ Technical Details

### Built With
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Browser Support
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

### Security & Privacy
- **Client-side only**: All processing happens in your browser
- **No data transmission**: Files never leave your device
- **No tracking**: No analytics or user data collection

## 🎨 Key Features

### Smart Format Detection
Automatically detects file format based on extension and content analysis.

### Semantic Comparison
When comparing different formats (e.g., JSON vs YAML), shows meaningful configuration differences rather than syntax differences.

### Advanced Filtering
- Filter by change type (added, removed, changed)
- Search within configuration keys and values
- Focus on specific sections or paths

### Export Options
- **JSON**: Complete comparison results with metadata
- **CSV**: Tabular format for spreadsheet analysis
- **HTML**: Formatted report for sharing
- **Patch**: Git-compatible patch file

## 📋 Requirements

- Modern web browser with ES2020 support
- No server or installation required for online use
- Node.js 16+ for local development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- Configuration file parsers: js-yaml, fast-xml-parser, ini, @iarna/toml
- UI components: Lucide React icons
- Styling: Tailwind CSS

---

**Simple, fast, and secure configuration file comparison in your browser.**