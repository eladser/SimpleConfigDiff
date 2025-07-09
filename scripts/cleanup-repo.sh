#!/bin/bash

# SimpleConfigDiff Repository Cleanup Script
# This script creates a clean repository history ready for publishing

echo "🧹 Starting repository cleanup..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "simple-config-diff" package.json; then
    echo "❌ Error: Please run this script from the SimpleConfigDiff root directory"
    exit 1
fi

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

echo "📦 Current branch: $CURRENT_BRANCH"

# Create orphan branch for clean history
echo "🌱 Creating clean branch..."
git checkout --orphan clean-main

# Add all files
echo "📁 Adding all files..."
git add .

# Create clean initial commit
echo "💫 Creating clean initial commit..."
git commit -m "Initial release: SimpleConfigDiff - A fast, browser-based configuration file comparison tool

✨ Features:
- Multiple format support (JSON, YAML, XML, INI, TOML, ENV, Properties, Config, HCL, CSV, Templates)
- Semantic comparison with intelligent diff analysis
- Three diff views: Side-by-side, Tree, and Unified
- Real-time processing in browser - no data leaves your device
- Dark mode with beautiful responsive design
- Advanced search and filtering capabilities
- Export options (JSON, CSV, HTML, Patch)
- TypeScript for type safety
- Modern React 18 with Vite build system

🚀 Ready for production use at https://eladser.github.io/SimpleConfigDiff/"

# Replace main branch
echo "🔄 Replacing main branch..."
git branch -D main
git branch -m clean-main main

# Force push clean history
echo "🚀 Pushing clean history..."
git push origin main --force

# Clean up GitHub Pages deployment
echo "🧹 Cleaning up GitHub Pages..."
git push origin --delete gh-pages 2>/dev/null || true

echo "✅ Repository cleanup complete!"
echo "📊 Commit history:"
git log --oneline

echo ""
echo "🎉 Your repository is now clean and ready for publishing!"
echo "🌐 To deploy to GitHub Pages, run: npm run deploy"
echo "⭐ Don't forget to add a star to showcase your project!"
