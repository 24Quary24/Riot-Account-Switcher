import React, { useState, useEffect } from 'react';
import { Settings, Folder, Key, Sliders, Bell, Check, RotateCcw } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  onSelectPath: () => Promise<string | null>;
  onNotify: (title: string, desc: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onSelectPath,
  onNotify,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleBrowsePath = async () => {
    const selected = await onSelectPath();
    if (selected) {
      setFormData(prev => ({
        ...prev,
        riotClientPath: selected,
        customPathEnabled: true,
      }));
    }
  };

  const handleResetDefaultPath = () => {
    setFormData(prev => ({
      ...prev,
      riotClientPath: 'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
      customPathEnabled: false,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(formData);
      onNotify('Settings Saved', 'Configuration updated successfully.', 'success');
    } catch (err: any) {
      onNotify('Error', err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '20px', color: '#FFF' }}>Application Settings</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Configure Riot Client paths, API keys, launch automation, and system tray behavior.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Riot Client Path */}
        <div className="stat-box" style={{ padding: '18px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} color="var(--riot-red)" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
              Riot Client Executable Location
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-input"
              value={formData.riotClientPath}
              onChange={(e) => setFormData({ ...formData, riotClientPath: e.target.value, customPathEnabled: true })}
              placeholder="C:\Riot Games\Riot Client\RiotClientServices.exe"
            />
            <button type="button" className="btn btn-secondary" onClick={handleBrowsePath}>
              Browse...
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={handleResetDefaultPath}
              title="Reset to default path"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Must point to RiotClientServices.exe. Used to launch Valorant and League with correct parameters.
          </span>
        </div>

        {/* Riot Games API Key */}
        <div className="stat-box" style={{ padding: '18px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="var(--hextech-gold)" />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
                Official Riot Games API Key (Optional)
              </span>
            </div>
            <a
              href="https://developer.riotgames.com"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '12px', color: 'var(--riot-teal)', textDecoration: 'none' }}
            >
              Get API Key →
            </a>
          </div>

          <input
            type="password"
            className="form-input"
            placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={formData.riotApiKey}
            onChange={(e) => setFormData({ ...formData, riotApiKey: e.target.value })}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            If provided, live Summoner rank, LP, and top Champion masteries are queried directly from Riot. If empty, the app uses local client LCU and smart cached statistics.
          </span>
        </div>

        {/* Launch & Automation Behaviors */}
        <div className="stat-box" style={{ padding: '18px', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--riot-teal)" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
              Launch & Process Automation
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.autoCloseClients}
                onChange={(e) => setFormData({ ...formData, autoCloseClients: e.target.checked })}
                style={{ accentColor: 'var(--riot-red)', width: '16px', height: '16px' }}
              />
              <span>Terminate running Riot Client / Game instances before switching accounts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.autoLaunchGame}
                onChange={(e) => setFormData({ ...formData, autoLaunchGame: e.target.checked })}
                style={{ accentColor: 'var(--riot-red)', width: '16px', height: '16px' }}
              />
              <span>Automatically start the selected game (Valorant or LoL) after client authentication</span>
            </label>

            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Login Prompt Wait Delay:</span>
                <span style={{ fontWeight: 700, color: 'var(--riot-teal)' }}>{formData.launchDelaySeconds} seconds</span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={formData.launchDelaySeconds}
                onChange={(e) => setFormData({ ...formData, launchDelaySeconds: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--riot-red)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Seconds to wait for Riot Client to open before automated keystroke credential injection.
              </span>
            </div>
          </div>
        </div>

        {/* System Tray & Interface */}
        <div className="stat-box" style={{ padding: '18px', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--val-diamond)" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
              System Tray & Window Options
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.minimizeToTray}
                onChange={(e) => setFormData({ ...formData, minimizeToTray: e.target.checked })}
                style={{ accentColor: 'var(--riot-red)', width: '16px', height: '16px' }}
              />
              <span>Minimize to System Tray when closing the window</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Color Theme:</span>
              <select
                className="form-select"
                style={{ width: '200px' }}
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value as any })}
              >
                <option value="dark">Riot Dark (#0A0A0A)</option>
                <option value="amoled">AMOLED Pure Black</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Check size={16} />
            {saving ? 'Saving Settings...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
