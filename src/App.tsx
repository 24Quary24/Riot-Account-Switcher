import React, { useState, useEffect, useCallback } from 'react';
import { Titlebar } from './components/Titlebar';
import { Navbar } from './components/Navbar';
import { AccountCard } from './components/AccountCard';
import { AccountDetailModal } from './components/AccountDetailModal';
import { AddEditAccountModal } from './components/AddEditAccountModal';
import { ImportExportModal } from './components/ImportExportModal';
import { PingView } from './components/PingView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { ToastContainer } from './components/ToastContainer';
import { RiotAccount, AppSettings, GameType, ToastMessage, PingResult } from './types';
import { Users, LogOut } from 'lucide-react';

const MOCK_INITIAL_ACCOUNTS: RiotAccount[] = [];

const DEFAULT_SETTINGS: AppSettings = {
  riotClientPath: 'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
  customPathEnabled: false,
  riotApiKey: '',
  autoCloseClients: true,
  autoLaunchGame: true,
  launchDelaySeconds: 4,
  minimizeToTray: true,
  startMinimized: false,
  theme: 'dark',
  soundEffects: true,
};

export const App: React.FC = () => {
  const [accounts, setAccounts] = useState<RiotAccount[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'accounts' | 'ping' | 'settings' | 'about'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState<GameType | 'all'>('all');

  // Modals & Panels
  const [selectedAccount, setSelectedAccount] = useState<RiotAccount | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<RiotAccount | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);

  // Status & Progress
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeSession, setActiveSession] = useState<{ riotId: string; tagline: string; puuid: string; region?: any } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).riotManagerApi;
  const api = (window as any).riotManagerApi;

  // Add Toast Notification Helper
  const addToast = useCallback((title: string, description?: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check Active Session
  const checkActiveSession = useCallback(async () => {
    if (isElectron && api.detectActiveSession) {
      try {
        const session = await api.detectActiveSession();
        setActiveSession(session);
      } catch {
        setActiveSession(null);
      }
    }
  }, [isElectron, api]);

  const handleForceLogout = async () => {
    if (!isElectron) return;
    setIsLoggingOut(true);
    addToast('Logging Out', 'Terminating Riot Client and clearing active session...', 'info');
    try {
      const res = await api.forceLogout();
      addToast('Logged Out', res.message || 'Riot Client session reset.', 'success');
      setActiveSession(null);
      await loadData();
    } catch (err: any) {
      addToast('Logout Failed', err.message || 'Could not log out Riot Client', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Load Accounts & Settings
  const loadData = useCallback(async () => {
    if (isElectron) {
      try {
        const accs = await api.getAccounts();
        setAccounts(accs);
        const sett = await api.getSettings();
        setSettings(sett);
        document.documentElement.setAttribute('data-theme', sett.theme || 'dark');
      } catch (err) {
        console.error('Failed to load data from Electron main process:', err);
      }
    } else {
      // Browser preview mode
      const saved = localStorage.getItem('riot_wrapper_accounts');
      if (saved) {
        setAccounts(JSON.parse(saved));
      } else {
        setAccounts(MOCK_INITIAL_ACCOUNTS);
      }
    }
  }, [isElectron, api]);

  useEffect(() => {
    loadData();
    checkActiveSession();

    const sessionInterval = setInterval(() => {
      checkActiveSession();
    }, 6000);

    // Subscribe to launch status updates
    let unsub: (() => void) | undefined;
    if (isElectron && api.onLaunchStatus) {
      unsub = api.onLaunchStatus((status: string) => {
        setLaunchStatus(status);
      });
    }

    return () => {
      clearInterval(sessionInterval);
      if (unsub) unsub();
    };
  }, [loadData, checkActiveSession, isElectron, api]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingAccount(null);
        setIsAddModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setActiveTab('settings');
      } else if ((e.ctrlKey || e.metaKey) && Number(e.key) >= 1 && Number(e.key) <= 9) {
        const idx = Number(e.key) - 1;
        if (accounts[idx]) {
          e.preventDefault();
          const target = accounts[idx];
          const primaryGame = target.games === 'league' ? 'league' : 'valorant';
          handleLaunchAccount(target.id, primaryGame);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accounts]);

  // Launch Account
  const handleLaunchAccount = async (accountId: string, game: 'valorant' | 'league') => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;

    setIsLaunching(true);
    setLaunchStatus(`Preparing ${game.toUpperCase()} for ${target.label}...`);

    if (isElectron) {
      try {
        const res = await api.launchAccount(accountId, game);
        if (res.success) {
          addToast('Client Launched', res.message, 'success');
        }
      } catch (err: any) {
        addToast('Launch Failed', err.message || 'Error executing Riot client', 'error');
      } finally {
        setIsLaunching(false);
        setLaunchStatus('');
        checkActiveSession();
      }
    } else {
      setTimeout(() => {
        setIsLaunching(false);
        setLaunchStatus('');
        addToast('Simulated Launch', `In production, Riot Client launches with ${target.username} and starts ${game.toUpperCase()}`, 'success');
      }, 1500);
    }
  };

  // Save Account (Add or Edit)
  const handleSaveAccount = async (account: RiotAccount, password?: string) => {
    if (isElectron) {
      await api.saveAccount(account, password);
      await loadData();
    } else {
      const idx = accounts.findIndex((a) => a.id === account.id);
      let updated: RiotAccount[];
      if (idx >= 0) {
        updated = [...accounts];
        updated[idx] = account;
      } else {
        updated = [...accounts, account];
      }
      setAccounts(updated);
      localStorage.setItem('riot_wrapper_accounts', JSON.stringify(updated));
    }

    addToast('Account Saved', `${account.label} credentials encrypted & saved securely.`, 'success');
  };

  // Toggle Favorite
  const handleToggleFavorite = async (account: RiotAccount) => {
    const updated = { ...account, isFavorite: !account.isFavorite };
    await handleSaveAccount(updated);
    addToast(
      updated.isFavorite ? 'Account Pinned' : 'Account Unpinned',
      `${account.label} ${updated.isFavorite ? 'pinned to top' : 'unpinned'}`,
      'info'
    );
  };

  // Delete Account
  const handleDeleteAccount = async (account: RiotAccount) => {
    if (window.confirm(`Are you sure you want to remove account "${account.label}"?`)) {
      if (isElectron) {
        await api.deleteAccount(account.id);
        await loadData();
      } else {
        const filtered = accounts.filter((a) => a.id !== account.id);
        setAccounts(filtered);
        localStorage.setItem('riot_wrapper_accounts', JSON.stringify(filtered));
      }
      addToast('Account Removed', `Account ${account.label} deleted.`, 'info');
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null);
      }
    }
  };


  // Settings Handlers
  const handleSaveSettings = async (newSettings: Partial<AppSettings>): Promise<AppSettings> => {
    if (isElectron) {
      const updated = await api.saveSettings(newSettings);
      setSettings(updated);
      document.documentElement.setAttribute('data-theme', updated.theme || 'dark');
      return updated;
    } else {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      document.documentElement.setAttribute('data-theme', merged.theme || 'dark');
      return merged;
    }
  };

  const handleSelectPath = async () => {
    if (isElectron) {
      return await api.selectRiotClientPath();
    }
    return null;
  };

  // Vault Handlers
  const handleExportVault = async (passphrase: string) => {
    if (isElectron) {
      return await api.exportAccounts(passphrase);
    }
    return JSON.stringify({ magic: 'RIOT_MGR_VAULT', accounts }, null, 2);
  };

  const handleImportVault = async (bundleJson: string, passphrase: string) => {
    if (isElectron) {
      const res = await api.importAccounts(bundleJson, passphrase);
      await loadData();
      return res;
    } else {
      const parsed = JSON.parse(bundleJson);
      setAccounts(parsed.accounts || []);
      return { importedCount: (parsed.accounts || []).length };
    }
  };

  // Ping Handler
  const handlePingRegions = async (): Promise<PingResult[]> => {
    if (isElectron) {
      return await api.pingRegions();
    }
    // Browser mock ping
    return [
      { region: 'NA', regionName: 'North America', city: 'Chicago / Ashburn', pingMs: 28, status: 'good' },
      { region: 'EUW', regionName: 'Europe West', city: 'Frankfurt / Amsterdam', pingMs: 104, status: 'medium' },
      { region: 'EUNE', regionName: 'Europe Nordic & East', city: 'Warsaw', pingMs: 118, status: 'medium' },
      { region: 'KR', regionName: 'Korea', city: 'Seoul', pingMs: 185, status: 'bad' },
      { region: 'AP', regionName: 'Asia Pacific', city: 'Tokyo / Singapore', pingMs: 162, status: 'bad' },
      { region: 'BR', regionName: 'Brazil', city: 'São Paulo', pingMs: 135, status: 'bad' },
      { region: 'LAN', regionName: 'Latin America North', city: 'Miami', pingMs: 44, status: 'good' },
      { region: 'LAS', regionName: 'Latin America South', city: 'Santiago', pingMs: 148, status: 'bad' },
      { region: 'OCE', regionName: 'Oceania', city: 'Sydney', pingMs: 220, status: 'bad' },
    ];
  };

  // Filtering & Sorting Accounts (Favorites always on top)
  const filteredAccounts = accounts
    .filter((acc) => {
      if (gameFilter !== 'all') {
        if (acc.games !== 'both' && acc.games !== gameFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = acc.label.toLowerCase().includes(q);
        const matchUser = acc.username.toLowerCase().includes(q);
        const matchRiotId = (acc.riotId || '').toLowerCase().includes(q);
        const matchTag = (acc.tagline || '').toLowerCase().includes(q);
        if (!matchLabel && !matchUser && !matchRiotId && !matchTag) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

  return (
    <div className="app-shell">
      {/* Frameless Titlebar */}
      <Titlebar
        onMinimize={() => api?.minimizeWindow()}
        onMaximize={() => api?.maximizeWindow()}
        onClose={() => api?.closeWindow()}
      />

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        gameFilter={gameFilter}
        setGameFilter={setGameFilter}
        onOpenAddModal={() => {
          setEditingAccount(null);
          setIsAddModalOpen(true);
        }}
        onOpenVaultModal={() => setIsVaultModalOpen(true)}
        onForceLogout={handleForceLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Main Content Viewport */}
      <main className="content-viewport">
        {activeTab === 'accounts' && (
          <div>
            {/* Active Session Status Banner */}
            {activeSession && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  marginBottom: '16px',
                  background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.2))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 8px #10b981',
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#e5e7eb' }}>
                    Currently Logged In:{' '}
                    <strong style={{ color: '#fff' }}>
                      {activeSession.riotId}#{activeSession.tagline}
                    </strong>{' '}
                    <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
                      ({activeSession.region || 'Active'})
                    </span>
                  </span>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleForceLogout}
                  disabled={isLoggingOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#f87171',
                    borderColor: 'rgba(248, 113, 113, 0.3)',
                    background: 'rgba(239, 68, 68, 0.08)',
                  }}
                  title="Close Riot Client and wipe active session"
                >
                  <LogOut size={13} />
                  {isLoggingOut ? 'Logging out...' : 'Log Out Riot Client'}
                </button>
              </div>
            )}
            {filteredAccounts.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-subtle)',
                  marginTop: '10px',
                }}
              >
                <Users size={48} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', color: '#FFF' }}>No Riot Accounts Found</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '380px', textAlign: 'center' }}>
                  {searchQuery
                    ? 'No accounts match your search filter. Try clearing the search.'
                    : 'Add your first Valorant or League of Legends account to get started with 1-click switching!'}
                </p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '20px' }}
                  onClick={() => {
                    setEditingAccount(null);
                    setIsAddModalOpen(true);
                  }}
                >
                  Add Riot Account
                </button>
              </div>
            ) : (
              <div className="account-grid">
                {filteredAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onLaunch={handleLaunchAccount}
                    onEdit={(acc) => {
                      setEditingAccount(acc);
                      setIsAddModalOpen(true);
                    }}
                    onDelete={handleDeleteAccount}
                    onSelect={(acc) => setSelectedAccount(acc)}
                    onToggleFavorite={handleToggleFavorite}
                    onRefresh={loadData}
                    isLaunching={isLaunching}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ping' && <PingView onFetchPing={handlePingRegions} />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onSelectPath={handleSelectPath}
            onNotify={addToast}
          />
        )}

        {activeTab === 'about' && <AboutView />}
      </main>

      {/* Account Details Slideout Drawer */}
      <AccountDetailModal
        account={selectedAccount}
        onClose={() => setSelectedAccount(null)}
        onLaunch={handleLaunchAccount}
        onRefresh={loadData}
        isLaunching={isLaunching}
      />

      {/* Add / Edit Account Modal */}
      <AddEditAccountModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={handleSaveAccount}
        editingAccount={editingAccount}
      />

      {/* Encrypted Vault Backup & Restore Modal */}
      <ImportExportModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        onExport={handleExportVault}
        onImport={handleImportVault}
        onNotify={addToast}
      />

      {/* Floating Launch Status Banner */}
      {isLaunching && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 20, 28, 0.94)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '10px 22px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1500,
            color: '#FFF',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderTopColor: 'var(--riot-red)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>{launchStatus || 'Switching accounts & preparing Riot Client...'}</span>
        </div>
      )}

      {/* Floating Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
