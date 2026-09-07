import React from 'react';
import { Users, Globe, Settings, HelpCircle, Plus, Search, ShieldCheck, LogOut, RefreshCw, ArrowUpDown } from 'lucide-react';
import { GameType } from '../types';

export type SortOption = 'recent' | 'name' | 'rank' | 'region';
export type FilterOption = GameType | 'all' | 'silent';

interface NavbarProps {
  activeTab: 'accounts' | 'ping' | 'settings' | 'about';
  setActiveTab: (tab: 'accounts' | 'ping' | 'settings' | 'about') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  gameFilter: FilterOption;
  setGameFilter: (filter: FilterOption) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  onOpenAddModal: () => void;
  onOpenVaultModal: () => void;
  onRefreshAll?: () => void;
  isRefreshingAll?: boolean;
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
  sortBy,
  setSortBy,
  onOpenAddModal,
  onOpenVaultModal,
  onRefreshAll,
  isRefreshingAll,
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
                placeholder="Search accounts, tags, or Riot ID..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'accounts' && onRefreshAll && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={onRefreshAll}
              disabled={isRefreshingAll}
              title="Refresh Ranks & Stats for All Accounts"
            >
              <RefreshCw size={15} style={{ animation: isRefreshingAll ? 'spin 1s linear infinite' : 'none' }} />
            </button>
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
              className={`pill-btn ${gameFilter === 'silent' ? 'active' : ''}`}
              onClick={() => setGameFilter('silent')}
              style={{ color: gameFilter === 'silent' ? '#fbbf24' : undefined }}
            >
              ⚡ Silent Ready
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpDown size={13} color="var(--text-muted)" />
              <select
                className="form-select"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  height: '28px',
                  background: 'rgba(255,255,255,0.04)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                title="Sort Accounts"
              >
                <option value="recent">Recently Played</option>
                <option value="name">Name (A–Z)</option>
                <option value="rank">Highest Rank</option>
                <option value="region">Region</option>
              </select>
            </div>

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
          </div>
        </div>
      )}
    </>
  );
};
