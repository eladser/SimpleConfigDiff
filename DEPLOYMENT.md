# GitHub Pages Deployment Guide

## Automatic Deployment (Recommended)

The GitHub Actions workflow will automatically deploy your site whenever you push to the main branch.

### Setup Steps:

1. **Enable GitHub Pages**
   - Go to your repository Settings
   - Scroll to "Pages" section
   - Set Source to "GitHub Actions"

2. **The workflow will automatically:**
   - Install dependencies
   - Build the project
   - Deploy to GitHub Pages

3. **Your site will be available at:**
   ```
   https://eladser.github.io/SimpleConfigDiff/
   ```

## Manual Deployment

If you prefer to deploy manually:

```bash
# Clone and setup
git clone https://github.com/eladser/SimpleConfigDiff.git
cd SimpleConfigDiff

# Install dependencies
npm install

# Build and deploy
npm run deploy
```

## Troubleshooting

### Common Issues:

1. **404 Errors**: Make sure the base path in `vite.config.ts` matches your repository name
2. **Build Failures**: Check that all dependencies are properly installed
3. **Permission Errors**: Ensure GitHub Actions has proper permissions in repository settings

### Build Commands:

```bash
# Development
npm run dev

# Build only
npm run build

# Preview build
npm run preview

# Deploy manually
npm run deploy
```

## Configuration

The project is configured for GitHub Pages with:

- **Base URL**: `/SimpleConfigDiff/`
- **Build output**: `dist/` directory
- **Deployment branch**: `gh-pages`

## GitHub Actions Workflow

The deployment workflow:
1. Triggers on push to main branch
2. Sets up Node.js environment
3. Installs dependencies without lock file
4. Builds the project
5. Deploys to GitHub Pages