import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Shield, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { RiotAccount, Region, GameType } from '../types';

interface AddEditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: RiotAccount, password?: string) => Promise<void>;
  editingAccount?: RiotAccount | null;
}

const REGIONS: { id: Region; label: string }[] = [
  { id: 'NA', label: 'North America (NA)' },
  { id: 'EUW', label: 'Europe West (EUW)' },
  { id: 'EUNE', label: 'Europe Nordic & East (EUNE)' },
  { id: 'KR', label: 'Korea (KR)' },
  { id: 'AP', label: 'Asia Pacific (AP)' },
  { id: 'BR', label: 'Brazil (BR)' },
  { id: 'LAN', label: 'Latin America North (LAN)' },
  { id: 'LAS', label: 'Latin America South (LAS)' },
  { id: 'OCE', label: 'Oceania (OCE)' },
];

export const AddEditAccountModal: React.FC<AddEditAccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingAccount,
}) => {
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [riotId, setRiotId] = useState('');
  const [tagline, setTagline] = useState('');
  const [region, setRegion] = useState<Region>('EUNE');
  const [games, setGames] = useState<GameType>('both');
  const [has2fa, setHas2fa] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectSuccess, setDetectSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingAccount) {
      setLabel(editingAccount.label);
      setUsername(editingAccount.username);
      setPassword('');
      setRiotId(editingAccount.riotId || '');
      setTagline(editingAccount.tagline || '');
      setRegion(editingAccount.region);
      setGames(editingAccount.games);
      setHas2fa(editingAccount.has2fa || false);
    } else {
      setLabel('');
      setUsername('');
      setPassword('');
      setRiotId('');
      setTagline('');
      setRegion('EUNE');
      setGames('both');
      setHas2fa(false);
      // Automatically attempt to detect active session in background
      autoDetectActiveSession(true);
    }
    setErrorMsg('');
    setDetectSuccess(false);
  }, [editingAccount, isOpen]);

  const autoDetectActiveSession = async (silent: boolean = false) => {
    try {
      setIsDetecting(true);
      const api = (window as any).riotManagerApi;
      if (!api || !api.detectActiveSession) return;
      const detected = await api.detectActiveSession();
      if (detected && detected.riotId) {
        setRiotId(detected.riotId);
        setTagline(detected.tagline);
        if (!label) setLabel(detected.riotId);
        if (detected.region) setRegion(detected.region);
        setDetectSuccess(true);
        setTimeout(() => setDetectSuccess(false), 4000);
      } else if (!silent) {
        setErrorMsg('No active Riot Client session detected. Please make sure Riot Client is open.');
      }
    } catch (err: any) {
      if (!silent) setErrorMsg('Failed to detect Riot session: ' + err.message);
    } finally {
      setIsDetecting(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMsg('Account label is required');
      return;
    }
    if (!username.trim()) {
      setErrorMsg('Username is required');
      return;
    }
    if (!editingAccount && !password.trim()) {
      setErrorMsg('Password is required for new accounts');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const accountData: RiotAccount = {
        id: editingAccount ? editingAccount.id : `acc-${Date.now()}`,
        label: label.trim(),
        username: username.trim(),
        region,
        games,
        riotId: riotId.trim(),
        tagline: tagline.trim(),
        has2fa,
        createdAt: editingAccount ? editingAccount.createdAt : new Date().toISOString(),
        valorantStats: editingAccount?.valorantStats,
        leagueStats: editingAccount?.leagueStats,
      };

      await onSave(accountData, password.trim() ? password.trim() : undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--riot-red)" />
            <h2>{editingAccount ? 'Edit Riot Account' : 'Add Riot Account'}</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(232, 64, 42, 0.15)',
                  border: '1px solid var(--riot-red)',
                  borderRadius: '4px',
                  color: '#FF6B6B',
                  marginBottom: '14px',
                  fontSize: '13px',
                }}
              >
                {errorMsg}
              </div>
            )}

            {detectSuccess && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(0, 245, 212, 0.12)',
                  border: '1px solid var(--riot-teal)',
                  borderRadius: '4px',
                  color: 'var(--riot-teal)',
                  marginBottom: '14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} /> Auto-detected Riot ID & Tagline from active Riot Client!
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Account Label</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Main Account, Alt / Smurf"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            {/* Auto-detect button bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Riot ID & Tagline
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => autoDetectActiveSession(false)}
                disabled={isDetecting}
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  color: 'var(--riot-teal)',
                  borderColor: 'rgba(0, 245, 212, 0.3)',
                  background: 'rgba(0, 245, 212, 0.06)',
                  borderRadius: '3px',
                }}
              >
                <Zap size={12} /> {isDetecting ? 'Detecting...' : 'Auto-Detect from Riot Client'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Riot ID (e.g. Chamborist)"
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tag (#ELO)"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '14px', marginTop: '4px' }}>
              Leave blank to automatically detect from running Riot Client session.
            </div>

            <div className="form-group">
              <label className="form-label">Login Username / Email</label>
              <input
                type="text"
                className="form-input"
                placeholder="Riot Client login username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password {editingAccount && '(leave blank to keep current)'}
              </label>
              <div className="input-with-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Hardware DPAPI encrypted password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editingAccount}
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Server Region</label>
                <select
                  className="form-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                >
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Associated Games</label>
                <select
                  className="form-select"
                  value={games}
                  onChange={(e) => setGames(e.target.value as GameType)}
                >
                  <option value="both">Both (VAL & LoL)</option>
                  <option value="valorant">VALORANT Only</option>
                  <option value="league">League of Legends Only</option>
                </select>
              </div>
            </div>

            {/* 2FA Indicator Toggle */}
            <div
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={18} color={has2fa ? 'var(--riot-teal)' : 'var(--text-dim)'} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF' }}>
                    Two-Factor Authentication (2FA / MFA)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Shows 2FA alert and prompts for email/auth code upon switching
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={has2fa}
                onChange={(e) => setHas2fa(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--riot-teal)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAccount ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
