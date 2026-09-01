import React from 'react';
import { X, Play, ShieldCheck, Key, User, Globe, Gamepad2 } from 'lucide-react';
import { RiotAccount } from '../types';

interface AccountDetailModalProps {
  account: RiotAccount | null;
  onClose: () => void;
  onLaunch: (accountId: string, game: 'valorant' | 'league') => void;
  isLaunching?: boolean;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onLaunch,
  isLaunching,
}) => {
  if (!account) return null;

  return (
    <div className="detail-drawer-overlay" onClick={onClose}>
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="card-avatar" style={{ width: '44px', height: '44px', fontSize: '17px', borderRadius: '4px' }}>
              {account.label.charAt(0).toUpperCase()}
              <span className={`game-dot-badge ${account.games === 'both' ? 'both' : account.games === 'valorant' ? 'val' : 'lol'}`} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', color: '#FFF' }}>{account.label}</h2>
                {account.has2fa && (
                  <span className="stat-chip accent-teal" style={{ padding: '2px 6px', fontSize: '10px' }}>
                    <ShieldCheck size={11} /> 2FA
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {account.riotId ? `${account.riotId}#${account.tagline || account.region}` : account.username}
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Login Info */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Login Details
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Username</span>
              <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, marginLeft: 'auto' }}>{account.username}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Password</span>
              <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, marginLeft: 'auto' }}>••••••••</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Region</span>
              <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, marginLeft: 'auto' }}>{account.region}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gamepad2 size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Games</span>
              <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, marginLeft: 'auto' }}>
                {account.games === 'both' ? 'VALORANT & League' : account.games === 'valorant' ? 'VALORANT' : 'League of Legends'}
              </span>
            </div>
          </div>

          {/* Launch Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(account.games === 'valorant' || account.games === 'both') && (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => onLaunch(account.id, 'valorant')}
                disabled={isLaunching}
              >
                <Play size={13} fill="#FFF" /> Play VALORANT
              </button>
            )}
            {(account.games === 'league' || account.games === 'both') && (
              <button
                className="btn btn-teal"
                style={{ flex: 1 }}
                onClick={() => onLaunch(account.id, 'league')}
                disabled={isLaunching}
              >
                <Play size={13} fill="#0A0A0A" /> Play League
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
