import type { NavBarProps } from '../types';

/**
 * Navigation bar component for switching between application pages
 * Uses neumorphism styling with active state indication
 * Provides accessible navigation with proper button semantics
 */
export function NavBar({ activePage, onPageChange }: NavBarProps): JSX.Element {
  return (
    <nav className="app-nav" aria-label="Main navigation">
      <button
        type="button"
        className={`app-nav-button${activePage === 'dashboard' ? ' active' : ''}`}
        onClick={() => onPageChange('dashboard')}
        aria-current={activePage === 'dashboard' ? 'page' : undefined}
      >
        Dashboard
      </button>
      <button
        type="button"
        className={`app-nav-button${activePage === 'stats' ? ' active' : ''}`}
        onClick={() => onPageChange('stats')}
        aria-current={activePage === 'stats' ? 'page' : undefined}
      >
        Statistics
      </button>
      <button
        type="button"
        className={`app-nav-button${activePage === 'settings' ? ' active' : ''}`}
        onClick={() => onPageChange('settings')}
        aria-current={activePage === 'settings' ? 'page' : undefined}
      >
        Settings
      </button>
    </nav>
  );
}
