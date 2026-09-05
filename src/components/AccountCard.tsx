import React, { useState } from 'react';
import { Play, ShieldCheck, MoreVertical, Edit2, Trash2, Copy, Check, Gamepad2, Zap, Star, RotateCcw, Info } from 'lucide-react';
import { RiotAccount } from '../types';

interface AccountCardProps {
  account: RiotAccount;
  onLaunch: (accountId: string, game: 'valorant' | 'league') => void;
  onEdit: (account: RiotAccount) => void;
  onDelete: (account: RiotAccount) => void;
  onSelect?: (account: RiotAccount) => void;
  onToggleFavorite?: (account: RiotAccount) => void;
  onRefresh?: () => void;
  isLaunching?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onLaunch,
  onEdit,
  onDelete,
  onSelect,
  onToggleFavorite,
  onRefresh,
  isLaunching,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);

  const handleCopyUsername = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account.username);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const formatLastPlayed = (isoString?: string) => {
    if (!isoString) return 'Never launched';
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Played just now';
    if (diffHours < 24) return `Played ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Played yesterday';
    return `Played ${diffDays}d ago`;
  };

  return (
    <div className="account-card" style={{ cursor: 'default', position: 'relative' }}>
      <div className="card-header">
        <div
          className="card-avatar-wrap"
          onClick={() => onSelect?.(account)}
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
          title={onSelect ? 'Click to view account statistics and details' : undefined}
        >
          <div className="card-avatar">
            {account.label.charAt(0).toUpperCase()}
            <span
              className={`game-dot-badge ${
                account.games === 'both' ? 'both' : account.games === 'valorant' ? 'val' : 'lol'
              }`}
            />
          </div>
          <div className="card-identity">
            <div className="account-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{account.label}</span>
              {onToggleFavorite && (
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(account);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: account.isFavorite ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={account.isFavorite ? 'Unpin account' : 'Pin account to top'}
                >
                  <Star size={13} fill={account.isFavorite ? '#fbbf24' : 'none'} />
                </button>
              )}
            </div>
            <div className="account-riot-id">
              {account.riotId ? `${account.riotId}#${account.tagline || account.region}` : account.username}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          {account.hasSavedSession && (
            <span
              className="stat-chip accent-gold"
              style={{ padding: '2px 6px', fontSize: '10px', gap: '3px', color: '#f59e0b' }}
              title="Silent Instant Switch (No keyboard or mouse interaction needed)"
            >
              <Zap size={11} /> Silent
            </span>
          )}
          {account.has2fa && (
            <span
              className="stat-chip accent-teal"
              style={{ padding: '2px 6px', fontSize: '10px', gap: '3px' }}
              title="Two-Factor Authentication Protected"
            >
              <ShieldCheck size={11} /> 2FA
            </span>
          )}
          <span className="region-tag">{account.region}</span>

          <button
            className="btn btn-secondary btn-icon btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            title="Account Options"
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: '#161920',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px',
                zIndex: 50,
                boxShadow: 'var(--shadow-md)',
                minWidth: '150px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onSelect && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                  onClick={() => {
                    setShowMenu(false);
                    onSelect(account);
                  }}
                >
                  <Info size={13} /> View Stats & Details
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                onClick={() => {
                  setShowMenu(false);
                  onEdit(account);
                }}
              >
                <Edit2 size={13} /> Edit Account
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                onClick={async () => {
                  setShowMenu(false);
                  const ok = await (window as any).riotManagerApi?.captureSession(account.id);
                  if (ok) {
                    onRefresh?.();
                  }
                }}
                title="Save current Riot Client session for silent switching"
              >
                <Zap size={13} /> Save Session
              </button>
              {account.hasSavedSession && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent', color: '#fb923c' }}
                  onClick={async () => {
                    setShowMenu(false);
                    await (window as any).riotManagerApi?.clearSession(account.id);
                    onRefresh?.();
                  }}
                  title="Clear saved silent session if tokens expired or changed"
                >
                  <RotateCcw size={13} /> Reset Session
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                onClick={(e) => {
                  setShowMenu(false);
                  handleCopyUsername(e);
                }}
              >
                <Copy size={13} /> Copy Username
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--riot-red)',
                }}
                onClick={() => {
                  setShowMenu(false);
                  onDelete(account);
                }}
              >
                <Trash2 size={13} /> Remove Account
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Login Username Pill with Click-to-Copy */}
        <div
          onClick={handleCopyUsername}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          title="Click to copy login username"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Username
            </span>
            <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600 }}>{account.username}</span>
          </div>
          <button
            type="button"
            className="btn btn-icon"
            style={{ padding: '2px', background: 'transparent', border: 'none', color: copiedUser ? 'var(--riot-teal)' : 'var(--text-dim)' }}
          >
            {copiedUser ? <Check size={14} /> : <Copy size={13} />}
          </button>
        </div>

        {/* Live Rank Badges if placed */}
        {((account.valorantStats?.rank && account.valorantStats.rank !== 'Unranked') ||
          (account.leagueStats?.soloRank && account.leagueStats.soloRank !== 'Unranked')) && (
          <div
            onClick={() => onSelect?.(account)}
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              cursor: onSelect ? 'pointer' : 'default',
            }}
          >
            {account.valorantStats?.rank && account.valorantStats.rank !== 'Unranked' && (
              <span
                className="stat-chip accent-red"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                title={`Valorant Rank: ${account.valorantStats.rank} (${account.valorantStats.rankRating} RR)`}
              >
                VAL: {account.valorantStats.rank}
              </span>
            )}
            {account.leagueStats?.soloRank && account.leagueStats.soloRank !== 'Unranked' && (
              <span
                className="stat-chip accent-gold"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                title={`LoL Solo/Duo: ${account.leagueStats.soloRank} (${account.leagueStats.soloLp} LP)`}
              >
                LoL: {account.leagueStats.soloRank}
              </span>
            )}
          </div>
        )}

        {/* Game Mode & Last Active Meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Gamepad2 size={13} color="var(--riot-teal)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {account.games === 'both'
                ? 'VALORANT & LEAGUE'
                : account.games === 'valorant'
                ? 'VALORANT'
                : 'LEAGUE OF LEGENDS'}
            </span>
          </div>
          <span>{formatLastPlayed(account.lastPlayed)}</span>
        </div>
      </div>

      <div className="card-footer" style={{ marginTop: '4px' }}>
        {(account.games === 'valorant' || account.games === 'both') && (
          <button
            className="btn btn-primary btn-play-game"
            onClick={() => onLaunch(account.id, 'valorant')}
            disabled={isLaunching}
            title="Switch account & Launch Valorant"
            style={{ flex: 1 }}
          >
            <Play size={13} fill="#FFF" />
            Play VALORANT
          </button>
        )}

        {(account.games === 'league' || account.games === 'both') && (
          <button
            className="btn btn-teal btn-play-game"
            onClick={() => onLaunch(account.id, 'league')}
            disabled={isLaunching}
            title="Switch account & Launch League of Legends"
            style={{ flex: 1 }}
          >
            <Play size={13} fill="#0A0A0A" />
            Play League
          </button>
        )}
      </div>
    </div>
  );
};
