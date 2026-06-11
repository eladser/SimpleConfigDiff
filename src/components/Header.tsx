import { version } from '../../package.json';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-baseline gap-3 font-mono text-sm">
          <span className="select-none">
            <span className="text-accent">$</span>{' '}
            <span className="text-fg font-semibold">configdiff</span>
          </span>
          <span className="text-faint text-xs hidden sm:inline">v{version}</span>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/eladser/SimpleConfigDiff"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted hover:text-fg transition-colors"
            aria-label="GitHub repository"
          >
            <GithubIcon className="w-5 h-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
