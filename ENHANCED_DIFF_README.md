# Enhanced Diff Display - Configuration File Comparison

## Overview

This branch introduces significant improvements to the diff display and comparison functionality, specifically designed to handle complex configuration files like XML, JSON, and YAML with better context and readability.

## Key Improvements

### 1. Enhanced Side-by-Side Diff (`EnhancedSideBySideDiff`)

- **Full Path Context**: Shows complete XML/JSON paths with proper hierarchy
- **Breadcrumb Navigation**: Displays parent > child relationships clearly
- **XML-Aware Parsing**: Handles XML attributes and elements intelligently
- **Hierarchical Grouping**: Groups changes by path structure for better organization
- **Advanced Filtering**: Enhanced search and filter capabilities

### 2. Enhanced Tree View (`EnhancedDiffTree`)

- **Intelligent Path Parsing**: Understands XML attributes like `[@name="value"]`
- **Auto-expand Matches**: Automatically expands tree nodes containing search results
- **Compact View**: Optional compact display mode for large files
- **Full Path Display**: Toggle between element names and full paths
- **Enhanced Icons**: Different icons for elements, attributes, and folders

### 3. Enhanced Unified Diff (`EnhancedUnifiedDiff`)

- **Structured Output**: Groups changes by path hierarchy
- **Copy/Download**: Easy export functionality
- **Line Numbers**: Optional line numbering
- **Context Display**: Shows full XML/JSON context for each change

## Features for Web.config Files

### XML Path Handling
- Correctly parses paths like `configuration.connectionStrings.add[@name='aioDatabaseConnectionString']`
- Displays breadcrumbs like `configuration › connectionStrings › add[name="aioDatabaseConnectionString"]`
- Groups related changes under parent elements

### Context Preservation
- Shows the full hierarchy of where each change occurs
- Preserves XML structure understanding
- Displays attribute names and values clearly

### Search and Filter
- Search across element names, attribute names, attribute values, and content
- Filter by change type (added, removed, changed)
- Highlight search terms in results

## Usage Examples

### For Web.config Comparison
1. Upload your two Web.config files
2. Enable "Enhanced Mode" (purple sparkle button)
3. Choose "Hierarchical" view mode for best XML structure representation
4. Use "Full Paths" to see complete element hierarchy
5. Use "Group by Path" to organize changes by parent elements

### Search Functionality
- Search for specific connection strings: `aioDatabaseConnectionString`
- Search for elements: `connectionStrings`
- Search for attributes: `name=`
- Search for values: `Server=192.168`

### View Modes
- **Hierarchical**: Best for XML/JSON with nested structure
- **Semantic**: Shows logical differences between configurations
- **Raw**: Line-by-line comparison (useful for identical formats)

## Technical Implementation

### Path Parsing
```typescript
// Handles XML paths with attributes
const parseXmlPath = (path: string) => {
  // Parses: "configuration.connectionStrings.add[@name='value']"
  // Returns: { element: "add", attribute: "name=\"value\"" }
}
```

### Breadcrumb Generation
```typescript
// Converts paths to readable breadcrumbs
const getBreadcrumbPath = (pathParts: string[]) => {
  // "configuration.connectionStrings.add[@name='value']"
  // Becomes: "configuration › connectionStrings › add[name="value"]"
}
```

### Hierarchical Grouping
```typescript
// Groups changes by parent path
const groupByPath = (changes) => {
  // Groups all connectionStrings changes together
  // Shows expandable sections for each parent element
}
```

## Benefits

1. **Better Context**: No more confusion about where changes are located
2. **Improved Readability**: Clear hierarchy and structure display
3. **Efficient Navigation**: Collapsible sections and smart grouping
4. **Enhanced Search**: Find specific elements, attributes, or values quickly
5. **Multiple View Options**: Choose the best view for your specific needs

## Configuration Options

### Display Options
- **Show Full Paths**: Toggle between element names and complete paths
- **Group by Path**: Organize changes by parent elements
- **Compact View**: Reduce spacing for large files
- **Auto-expand Matches**: Automatically expand search results

### Search Options
- **Search Term**: Find specific text in paths, elements, or values
- **Filter by Type**: Show only added, removed, or changed items
- **Case Sensitivity**: Optional case-sensitive search

## Compatibility

- Fully backward compatible with existing functionality
- Enhanced mode can be toggled on/off
- Works with all supported file formats (XML, JSON, YAML, etc.)
- Maintains all existing export and advanced options

## Performance

- Lazy loading of heavy components
- Efficient rendering with React.memo and useMemo
- Background parsing with requestIdleCallback
- Optimized for large configuration files

## Future Enhancements

1. **Schema-aware comparison** for specific config types
2. **Diff merging** capabilities
3. **Configuration validation** during comparison
4. **Custom path rules** for specific XML structures
5. **Integration with version control** systems

This enhanced diff display makes comparing complex configuration files much more intuitive and user-friendly, especially for XML files like Web.config where understanding the hierarchical structure is crucial.