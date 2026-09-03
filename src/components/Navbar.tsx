import React from 'react';
import { Users, Globe, Settings, HelpCircle, Plus, Search, ShieldCheck, LogOut } from 'lucide-react';
import { GameType } from '../types';

interface NavbarProps {
  activeTab: 'accounts' | 'ping' | 'settings' | 'about';
  setActiveTab: (tab: 'accounts' | 'ping' | 'settings' | 'about') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  gameFilter: GameType | 'all';
  setGameFilter: (filter: GameType | 'all') => void;
  onOpenAddModal: () => void;
  onOpenVaultModal: () => void;
  onForceLogout?: () => void;
  isLoggingOut?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  gameFilter,
  setGameFilter,
  onOpenAddModal,
  onOpenVaultModal,
  onForceLogout,
  isLoggingOut,
}) => {
  return (
    <>
      <header className="top-navbar">
        <div className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <Users size={16} />
            Accounts
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'ping' ? 'active' : ''}`}
            onClick={() => setActiveTab('ping')}
          >
            <Globe size={16} />
            Live Ping
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <HelpCircle size={16} />
            About
          </button>
        </div>

        <div className="nav-actions">
          {activeTab === 'accounts' && (
            <div className="search-input-wrap">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search accounts or Riot ID..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <button
            className="btn btn-secondary btn-icon"
            onClick={onOpenVaultModal}
            title="Encrypted Backup / Import Vault"
          >
            <ShieldCheck size={16} color="var(--riot-teal)" />
          </button>

          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            Add Account
          </button>
        </div>
      </header>

      {activeTab === 'accounts' && (
        <div className="filter-bar">
          <div className="filter-pills">
            <button
              className={`pill-btn ${gameFilter === 'all' ? 'active' : ''}`}
              onClick={() => setGameFilter('all')}
            >
              All Accounts
            </button>
            <button
              className={`pill-btn ${gameFilter === 'valorant' ? 'active' : ''}`}
              onClick={() => setGameFilter('valorant')}
            >
              VALORANT
            </button>
            <button
              className={`pill-btn ${gameFilter === 'league' ? 'active' : ''}`}
              onClick={() => setGameFilter('league')}
            >
              League of Legends
            </button>
            <button
              className={`pill-btn ${gameFilter === 'both' ? 'active' : ''}`}
              onClick={() => setGameFilter('both')}
            >
              Dual Games
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onForceLogout && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onForceLogout}
                disabled={isLoggingOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  padding: '4px 10px',
                  color: '#f87171',
                  borderColor: 'rgba(248, 113, 113, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                }}
                title="Terminate running Riot Client processes and clear active session on disk"
              >
                <LogOut size={12} />
                {isLoggingOut ? 'Logging out...' : 'Log Out Client'}
              </button>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Shortcut: <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + N</kbd> to add account
            </div>
          </div>
        </div>
      )}
    </>
  );
};
