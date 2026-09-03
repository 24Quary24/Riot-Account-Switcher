import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ShieldCheck, Key, User, Tag, Globe, Gamepad2 } from 'lucide-react';
import { RiotAccount, Region, GameType } from '../types';

interface AddEditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: RiotAccount, password?: string) => Promise<void>;
  editingAccount: RiotAccount | null;
}

const REGIONS: { value: Region; label: string }[] = [
  { value: 'EUW', label: 'Europe West (EUW)' },
  { value: 'EUNE', label: 'Europe Nordic & East (EUNE)' },
  { value: 'NA', label: 'North America (NA)' },
  { value: 'KR', label: 'Korea (KR)' },
  { value: 'AP', label: 'Asia Pacific (AP)' },
  { value: 'BR', label: 'Brazil (BR)' },
  { value: 'LAN', label: 'Latin America North (LAN)' },
  { value: 'LAS', label: 'Latin America South (LAS)' },
  { value: 'OCE', label: 'Oceania (OCE)' },
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
  const [region, setRegion] = useState<Region>('EUW');
  const [games, setGames] = useState<GameType>('both');
  const [has2fa, setHas2fa] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
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
      setRegion('EUW');
      setGames('both');
      setHas2fa(false);
    }
    setErrorMsg('');
    setShowPassword(false);
  }, [editingAccount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setErrorMsg('Account label is required'); return; }
    if (!username.trim()) { setErrorMsg('Username is required'); return; }
    if (!editingAccount && !password.trim()) { setErrorMsg('Password is required for new accounts'); return; }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      let finalRiotId = riotId.trim();
      let finalTagline = tagline.trim().replace(/^#/, '');
      if (finalRiotId.includes('#')) {
        const [idPart, tagPart] = finalRiotId.split('#');
        finalRiotId = idPart.trim();
        if (!finalTagline && tagPart) finalTagline = tagPart.trim();
      }

      const accountData: RiotAccount = {
        id: editingAccount ? editingAccount.id : `acc-${Date.now()}`,
        label: label.trim(),
        username: username.trim(),
        region,
        games,
        riotId: finalRiotId,
        tagline: finalTagline,
        has2fa,
        isFavorite: editingAccount?.isFavorite || false,
        createdAt: editingAccount ? editingAccount.createdAt : new Date().toISOString(),
      };
      await onSave(accountData, password.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--riot-teal)" />
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#FFF' }}>
              {editingAccount ? 'Edit Account' : 'Add Riot Account'}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div style={{ padding: '8px 12px', background: 'rgba(235,0,41,0.12)', border: '1px solid var(--riot-red)', borderRadius: '4px', color: '#FF6B7A', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}

            {/* Label */}
            <div className="form-group">
              <label className="form-label"><Tag size={12} style={{ display: 'inline', marginRight: '4px' }} />Account Label / Nickname *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Main, Smurf, Herdyn"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            {/* Username + Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label"><User size={12} style={{ display: 'inline', marginRight: '4px' }} />Login Username *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Riot username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label"><Key size={12} style={{ display: 'inline', marginRight: '4px' }} />{editingAccount ? 'Password (blank = keep)' : 'Password *'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Game + Region */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label"><Gamepad2 size={12} style={{ display: 'inline', marginRight: '4px' }} />Target Game</label>
                <select className="form-input" value={games} onChange={(e) => setGames(e.target.value as GameType)}>
                  <option value="both">Valorant & League</option>
                  <option value="valorant">VALORANT Only</option>
                  <option value="league">League of Legends Only</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label"><Globe size={12} style={{ display: 'inline', marginRight: '4px' }} />Region</label>
                <select className="form-input" value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Riot ID (optional) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">In-Game Riot ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Veltx or Veltx#EUW"
                  value={riotId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('#')) {
                      const [idPart, tagPart] = val.split('#');
                      setRiotId(idPart.trim());
                      if (tagPart) setTagline(tagPart.trim());
                    } else {
                      setRiotId(val);
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="EUNE, ELO"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value.replace(/^#/, ''))}
                />
              </div>
            </div>

            {/* 2FA toggle */}
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={16} color={has2fa ? 'var(--riot-teal)' : 'var(--text-dim)'} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFF' }}>Two-Factor Authentication (2FA)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Shows 2FA badge on the card</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={has2fa}
                onChange={(e) => setHas2fa(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--riot-teal)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAccount ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
