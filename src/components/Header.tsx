import { RefreshCw, Github, Star } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <RefreshCw className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SimpleConfigDiff
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Compare configuration files with ease
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <a
              href="https://github.com/eladser/SimpleConfigDiff"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <Github className="w-5 h-5" />
              <span className="hidden sm:inline">View on GitHub</span>
            </a>
            
            <a
              href="https://github.com/eladser/SimpleConfigDiff"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
            >
              <Star className="w-4 h-4" />
              <span className="text-sm font-medium">Star</span>
            </a>
          </div>
        </div>
      </div>
      
      <div className="bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
            <span className="font-medium">Supported formats:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'JSON', icon: '{}' },
                { name: 'YAML', icon: '📄' },
                { name: 'XML', icon: '</>' },
                { name: 'INI', icon: '📝' },
                { name: 'TOML', icon: '🔧' },
                { name: 'ENV', icon: '🌍' },
                { name: 'HCL', icon: '🏗️' },
                { name: 'Properties', icon: '☕' },
                { name: 'Config', icon: '⚙️' }
              ].map(format => (
                <span
                  key={format.name}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-800/50 rounded-md text-xs font-medium"
                >
                  <span>{format.icon}</span>
                  {format.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}