import { RefreshCw, Github, ExternalLink } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-slate-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <RefreshCw className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                SimpleConfigDiff
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Advanced configuration file comparison tool
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <a
              href="https://github.com/eladser/SimpleConfigDiff"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">GitHub</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
      
      {/* Supported Formats Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-blue-700 dark:text-blue-300">Supported formats:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'JSON', icon: '{}', color: 'from-yellow-400 to-orange-400' },
                { name: 'YAML', icon: '📄', color: 'from-emerald-400 to-blue-400' },
                { name: 'XML', icon: '</>', color: 'from-red-400 to-pink-400' },
                { name: 'INI', icon: '📝', color: 'from-purple-400 to-blue-400' },
                { name: 'TOML', icon: '🔧', color: 'from-orange-400 to-red-400' },
                { name: 'ENV', icon: '🌍', color: 'from-emerald-400 to-teal-400' },
                { name: 'Properties', icon: '☕', color: 'from-amber-400 to-orange-400' },
                { name: 'Config', icon: '⚙️', color: 'from-slate-400 to-blue-400' }
              ].map((format, index) => (
                <span
                  key={format.name}
                  className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r ${format.color} rounded-lg text-xs font-medium text-white shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-105`}
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.5s ease-out forwards'
                  }}
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