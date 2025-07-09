# 🔄 SimpleConfigDiff

A professional, browser-based tool that compares configuration files and outputs human-friendly structured diffs. Built with React, TypeScript, and TailwindCSS.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 🚀 Features

### 📁 **Multi-Format Support**
- **JSON** - JavaScript Object Notation
- **YAML** - YAML Ain't Markup Language  
- **XML** - Extensible Markup Language
- **INI** - Configuration files with sections
- **TOML** - Tom's Obvious, Minimal Language
- **ENV** - Environment variable files
- **.config** - XML-based configuration files

### 🔍 **Advanced Diff Engine**
- **Smart Detection** - Automatically detects file format
- **Deep Comparison** - Handles nested objects and arrays
- **Type-Aware** - Understands different data types
- **Flexible Options** - Customize comparison behavior

### 🎨 **Professional UI**
- **Drag & Drop** - Easy file upload
- **Tree View** - Hierarchical diff visualization
- **Flat View** - Linear diff display
- **Color Coding** - Visual distinction for changes
- **Responsive Design** - Works on all devices

### ⚙️ **Comparison Options**
- **Ignore Keys** - Skip specific keys during comparison
- **Case Sensitivity** - Control case-sensitive matching
- **Key Sorting** - Sort keys before comparison
- **Key Flattening** - Convert nested objects to dot notation

### 📊 **Export & Share**
- **Markdown Export** - Generate readable reports
- **JSON Export** - Machine-readable diff data
- **Share Links** - Share comparison results
- **Summary Statistics** - Quick overview of changes

## 🛠️ Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/eladser/SimpleConfigDiff.git
   cd SimpleConfigDiff
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Production Build

```bash
npm run build
npm run preview
```

## 📖 Usage

### Basic Usage

1. **Upload Files** - Drag and drop or click to select two configuration files
2. **Configure Options** - Set comparison preferences (optional)
3. **Compare** - Click the "Compare Files" button
4. **View Results** - Explore differences in tree or flat view
5. **Export** - Download results as Markdown or JSON

### Example Files

**config-a.json**
```json
{
  "server": {
    "port": 8080,
    "ssl": false
  },
  "database": {
    "host": "localhost",
    "user": "admin"
  }
}
```

**config-b.yaml**
```yaml
server:
  port: 3000
  ssl: true
database:
  host: "localhost"
  user: "admin"
  password: "secret"
```

**Result**
```
🟨 server.port: 8080 → 3000
🟨 server.ssl: false → true
🟩 database.password: "secret"
```

## 🔧 Configuration Options

### Ignore Keys
Skip specific keys during comparison:
```javascript
ignoreKeys: ['timestamp', 'version', 'lastModified']
```

### Case Sensitivity
Control case-sensitive key matching:
```javascript
caseSensitive: false // 'Name' equals 'name'
```

### Key Sorting
Sort keys alphabetically before comparison:
```javascript
sortKeys: true
```

### Key Flattening
Convert nested objects to dot notation:
```javascript
flattenKeys: true
// { "server": { "port": 8080 } } → { "server.port": 8080 }
```

## 🏗️ Architecture

### Project Structure
```
SimpleConfigDiff/
├── src/
│   ├── components/          # React components
│   │   ├── DiffViewer.tsx   # Main diff display
│   │   ├── FileUpload.tsx   # File upload interface
│   │   ├── OptionsPanel.tsx # Comparison options
│   │   └── ...
│   ├── utils/               # Utility functions
│   │   ├── parsers.ts       # File format parsers
│   │   ├── generateDiff.ts  # Diff generation
│   │   └── ...
│   ├── types/               # TypeScript definitions
│   └── App.tsx             # Main application
├── public/                  # Static assets
└── dist/                   # Build output
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 | UI framework |
| **Language** | TypeScript | Type safety |
| **Build Tool** | Vite | Fast development |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Icons** | Lucide React | Icon library |
| **Parsing** | Multiple libs | Format-specific parsers |

### Parser Libraries

| Format | Library | Features |
|--------|---------|-----------|
| JSON | Native | Built-in support |
| YAML | js-yaml | Full YAML 1.2 support |
| XML | fast-xml-parser | Attributes, namespaces |
| INI | ini | Sections, type conversion |
| TOML | @iarna/toml | Spec-compliant |
| ENV | Custom | Comments, type inference |

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use meaningful component names
- Write descriptive commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - The web framework
- [Vite](https://vitejs.dev/) - Build tool
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML parser
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) - XML parser
- [Lucide](https://lucide.dev/) - Icons

## 📞 Support

If you have questions or need help:

1. **Check the documentation** in this README
2. **Search existing issues** on GitHub
3. **Create a new issue** if needed
4. **Join discussions** in the repository

---

<div align="center">
  <strong>Made with ❤️ by eladser</strong>
</div>