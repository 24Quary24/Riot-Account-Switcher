import React, { useState } from 'react';
import { X, Play, ShieldCheck, Key, User, Globe, Gamepad2, RefreshCw, Zap, Trophy, Coins, Sparkles, Award } from 'lucide-react';
import { RiotAccount } from '../types';

interface AccountDetailModalProps {
  account: RiotAccount | null;
  onClose: () => void;
  onLaunch: (accountId: string, game: 'valorant' | 'league') => void;
  onRefresh?: () => void;
  isLaunching?: boolean;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onLaunch,
  onRefresh,
  isLaunching,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!account) return null;

  const handleRefreshStats = async () => {
    const api = (window as any).riotManagerApi;
    if (api?.refreshAccountStats) {
      setIsRefreshing(true);
      try {
        await api.refreshAccountStats(account);
        onRefresh?.();
      } catch (err) {
        console.error('Failed to refresh stats:', err);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const valStats = account.valorantStats;
  const lolStats = account.leagueStats;

  return (
    <div className="detail-drawer-overlay" onClick={onClose}>
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="card-avatar" style={{ width: '44px', height: '44px', fontSize: '17px', borderRadius: '4px' }}>
              {account.label.charAt(0).toUpperCase()}
              <span className={`game-dot-badge ${account.games === 'both' ? 'both' : account.games === 'valorant' ? 'val' : 'lol'}`} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', color: '#FFF' }}>{account.label}</h2>
                {account.hasSavedSession && (
                  <span className="stat-chip accent-gold" style={{ padding: '2px 6px', fontSize: '10px' }} title="Silent 1-Click Launch">
                    <Zap size={10} /> Silent
                  </span>
                )}
                {account.has2fa && (
                  <span className="stat-chip accent-teal" style={{ padding: '2px 6px', fontSize: '10px' }}>
                    <ShieldCheck size={10} /> 2FA
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {account.riotId ? `${account.riotId}#${account.tagline || account.region}` : account.username}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-secondary btn-icon btn-sm"
              onClick={handleRefreshStats}
              disabled={isRefreshing}
              title="Refresh Account Stats"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
            </button>
            <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Action Launch Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(account.games === 'valorant' || account.games === 'both') && (
              <button
                className="btn btn-primary btn-play-game"
                style={{ flex: 1 }}
                onClick={() => onLaunch(account.id, 'valorant')}
                disabled={isLaunching}
              >
                <Play size={13} fill="#FFF" /> Play VALORANT
              </button>
            )}
            {(account.games === 'league' || account.games === 'both') && (
              <button
                className="btn btn-teal btn-play-game"
                style={{ flex: 1 }}
                onClick={() => onLaunch(account.id, 'league')}
                disabled={isLaunching}
              >
                <Play size={13} fill="#0A0A0A" /> Play League
              </button>
            )}
          </div>

          {/* Valorant Stats Section */}
          {(account.games === 'valorant' || account.games === 'both') && (
            <div style={{ background: 'rgba(235, 0, 41, 0.05)', border: '1px solid rgba(235, 0, 41, 0.2)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--riot-red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  VALORANT Profile & Balances
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Lvl {valStats?.accountLevel || 1}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Rank</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={13} color="var(--riot-red)" />
                    {valStats?.rank || 'Unranked'}
                  </div>
                  {valStats && valStats.rankRating > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{valStats.rankRating} RR</div>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Valorant Points</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={13} color="#f59e0b" />
                    {valStats?.vpBalance?.toLocaleString() || 0} VP
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {valStats?.radianiteBalance || 0} Radianite
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Kingdom Credits: <strong style={{ color: '#FFF' }}>{valStats?.kcBalance || 0}</strong></span>
                <span>Skins: <strong style={{ color: '#FFF' }}>{valStats?.skinsOwned || 0}</strong></span>
                <span>Agents: <strong style={{ color: '#FFF' }}>{valStats?.agentsUnlocked || 5}</strong></span>
              </div>
            </div>
          )}

          {/* League of Legends Stats Section */}
          {(account.games === 'league' || account.games === 'both') && (
            <div style={{ background: 'rgba(0, 178, 169, 0.05)', border: '1px solid rgba(0, 178, 169, 0.2)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--riot-teal)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  League of Legends Stats
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Lvl {lolStats?.summonerLevel || 1}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Solo/Duo Rank</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={13} color="var(--hextech-gold)" />
                    {lolStats?.soloRank || 'Unranked'}
                  </div>
                  {lolStats && lolStats.soloLp > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{lolStats.soloLp} LP</div>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Wallet</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} color="var(--riot-teal)" />
                    {lolStats?.rpBalance?.toLocaleString() || 0} RP
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {lolStats?.beBalance?.toLocaleString() || 0} BE
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Winrate: <strong style={{ color: '#FFF' }}>{lolStats?.soloWinrate || 0}%</strong></span>
                <span>Flex: <strong style={{ color: '#FFF' }}>{lolStats?.flexRank || 'Unranked'}</strong></span>
                <span>Champs: <strong style={{ color: '#FFF' }}>{lolStats?.championsOwned || 0}</strong></span>
              </div>
            </div>
          )}

          {/* Account Credentials & Identifiers */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Account Metadata
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Login Username</span>
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
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configured Target</span>
              <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 600, marginLeft: 'auto' }}>
                {account.games === 'both' ? 'VALORANT & League' : account.games === 'valorant' ? 'VALORANT' : 'League of Legends'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
