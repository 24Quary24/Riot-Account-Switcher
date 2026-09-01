import React, { useState } from 'react';
import { X, Play, RefreshCw, Flame, Shield, Trophy, Coins, Sparkles, UserCheck, ShieldCheck, Crosshair, Award } from 'lucide-react';
import { RiotAccount } from '../types';

interface AccountDetailModalProps {
  account: RiotAccount | null;
  onClose: () => void;
  onLaunch: (accountId: string, game: 'valorant' | 'league') => void;
  onRefresh: (account: RiotAccount) => void;
  isRefreshing?: boolean;
  isLaunching?: boolean;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onLaunch,
  onRefresh,
  isRefreshing,
  isLaunching,
}) => {
  if (!account) return null;

  const defaultGameTab = account.games === 'league' ? 'league' : 'valorant';
  const [activeGameTab, setActiveGameTab] = useState<'valorant' | 'league'>(defaultGameTab);

  const valStats = account.valorantStats;
  const lolStats = account.leagueStats;

  const valLevel = valStats?.accountLevel || valStats?.battlePassLevel || 1;
  const lolLevel = lolStats?.summonerLevel || 1;

  return (
    <div className="detail-drawer-overlay" onClick={onClose}>
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="card-avatar" style={{ width: '48px', height: '48px', fontSize: '18px', borderRadius: '4px' }}>
              {account.label.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', color: '#FFF' }}>{account.label}</h2>
                {account.has2fa && (
                  <span
                    className="stat-chip accent-teal"
                    style={{ padding: '2px 7px', fontSize: '10px' }}
                    title="Two-Factor Authentication Active"
                  >
                    <ShieldCheck size={12} /> 2FA Active
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {account.riotId ? `${account.riotId}#${account.tagline || 'NA1'}` : account.username}
                </span>
                <span className="region-tag">{account.region}</span>
                <span className="level-tag">
                  VAL LVL {valLevel}
                </span>
                {account.games !== 'valorant' && (
                  <span className="level-tag lol">
                    LOL LVL {lolLevel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => onRefresh(account)}
              disabled={isRefreshing}
              title="Refresh Live Stats from Riot Client"
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Game Switcher Tabs */}
        {account.games === 'both' && (
          <div style={{ display: 'flex', padding: '12px 24px 0 24px', gap: '8px', background: 'var(--bg-secondary)' }}>
            <button
              className={`pill-btn ${activeGameTab === 'valorant' ? 'active' : ''}`}
              onClick={() => setActiveGameTab('valorant')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '4px' }}
            >
              <Flame size={14} color="var(--riot-red)" /> VALORANT
            </button>
            <button
              className={`pill-btn ${activeGameTab === 'league' ? 'active' : ''}`}
              onClick={() => setActiveGameTab('league')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '4px' }}
            >
              <Shield size={14} color="var(--riot-teal)" /> League of Legends
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Quick Launch Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'linear-gradient(90deg, rgba(255, 70, 85, 0.12), rgba(0, 245, 212, 0.12))',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                Instant Client Switching
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Auto-injects credentials via secure standard input pipe
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {(account.games === 'valorant' || account.games === 'both') && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onLaunch(account.id, 'valorant')}
                  disabled={isLaunching}
                >
                  <Play size={12} fill="#FFF" /> Play VAL
                </button>
              )}
              {(account.games === 'league' || account.games === 'both') && (
                <button
                  className="btn btn-teal btn-sm"
                  onClick={() => onLaunch(account.id, 'league')}
                  disabled={isLaunching}
                >
                  <Play size={12} fill="#0A0A0A" /> Play LoL
                </button>
              )}
            </div>
          </div>

          {/* VALORANT STATS VIEW */}
          {(activeGameTab === 'valorant' || account.games === 'valorant') && valStats && (
            <>
              {/* Stats Grid 4 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Competitive Rank</span>
                  <span className="stat-value" style={{ color: valStats.rank === 'Unranked' ? 'var(--text-muted)' : 'var(--val-plat)' }}>
                    {valStats.rank}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {valStats.rankRating} RR · Peak: {valStats.peakRank}
                  </span>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Account Level</span>
                  <span className="stat-value" style={{ color: 'var(--riot-teal)' }}>
                    Level {valLevel}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {valLevel < 20 ? 'Ranked Unlocks at Lvl 20' : 'Competitive Unlocked'}
                  </span>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Wallet Currencies</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                      {valStats.vpBalance.toLocaleString()} VP
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--riot-teal)', fontWeight: 600 }}>
                      {valStats.radianiteBalance} Radianite · {(valStats.kcBalance || 0).toLocaleString()} KC
                    </span>
                  </div>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Collection</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--hextech-gold)' }}>
                      {valStats.skinsOwned || 0} Weapon Skins
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {valStats.agentsUnlocked || 5} Agents Available
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Valorant Matches */}
              <div>
                <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Competitive Matches
                </h3>

                {valStats.recentMatches && valStats.recentMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {valStats.recentMatches.map((m) => (
                      <div key={m.id} className={`match-history-card ${m.result}`} style={{ borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '4px',
                              background: '#1A1D24',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 800,
                              color: m.result === 'win' ? 'var(--riot-teal)' : 'var(--riot-red)',
                            }}
                          >
                            {m.agent.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                              {m.agent} · <span style={{ color: 'var(--text-muted)' }}>{m.map}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              {m.gameMode} · {m.playedAt}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFF' }}>
                            {m.score}
                          </div>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: m.result === 'win' ? 'var(--riot-teal)' : 'var(--riot-red)',
                            }}
                          >
                            {m.result}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                            {m.kills} / <span style={{ color: '#EF4444' }}>{m.deaths}</span> / {m.assists}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            HS: {m.headshotPct}% · KDA: {((m.kills + m.assists) / Math.max(1, m.deaths)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    {valLevel < 20
                      ? `No ranked games played yet. This account is Level ${valLevel} (Competitive queue unlocks at Level 20).`
                      : 'No recent matches recorded in current cycle. Play a game or click Refresh Stats to sync.'}
                  </div>
                )}
              </div>
            </>
          )}

          {/* LEAGUE OF LEGENDS STATS VIEW */}
          {(activeGameTab === 'league' || account.games === 'league') && lolStats && (
            <>
              {/* High Level Stats Grid 4 Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Solo/Duo Rank</span>
                  <span className="stat-value" style={{ color: lolStats.soloRank === 'Unranked' ? 'var(--text-muted)' : 'var(--hextech-gold)' }}>
                    {lolStats.soloRank}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {lolStats.soloLp} LP {lolStats.soloWinrate ? `· ${lolStats.soloWinrate}% WR` : ''}
                  </span>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Summoner Level</span>
                  <span className="stat-value" style={{ color: 'var(--hextech-gold)' }}>
                    Level {lolLevel}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Flex: {lolStats.flexRank} ({lolStats.flexLp} LP)
                  </span>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">League Currencies</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--hextech-gold)' }}>
                      {lolStats.rpBalance.toLocaleString()} RP
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--riot-teal)', fontWeight: 600 }}>
                      {lolStats.beBalance.toLocaleString()} Blue Essence
                    </span>
                  </div>
                </div>

                <div className="stat-box" style={{ borderRadius: '4px' }}>
                  <span className="stat-label">Champions & Skins</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                      {lolStats.championsOwned || 0} Champions
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {lolStats.skinsOwned || 0} Skins Owned
                    </span>
                  </div>
                </div>
              </div>

              {/* Champion Mastery */}
              {lolStats.topMastery && lolStats.topMastery.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Top Champion Mastery
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {lolStats.topMastery.map((champ, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <img
                          src={champ.championIcon}
                          alt={champ.championName}
                          style={{ width: '40px', height: '40px', borderRadius: '4px' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jinx.png';
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>{champ.championName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--hextech-gold)', fontWeight: 600 }}>
                            Level {champ.championLevel}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            {(champ.championPoints / 1000).toFixed(0)}k pts
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent League Matches */}
              <div>
                <h3 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Matches
                </h3>

                {lolStats.recentMatches && lolStats.recentMatches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lolStats.recentMatches.map((m) => (
                      <div key={m.id} className={`match-history-card ${m.result}`} style={{ borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={m.championIcon}
                            alt={m.champion}
                            style={{ width: '36px', height: '36px', borderRadius: '4px' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jinx.png';
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                              {m.champion} · <span style={{ color: 'var(--text-muted)' }}>{m.role}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              {m.gameMode} · {m.playedAt}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: '2px',
                              background: m.result === 'win' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(255, 70, 85, 0.15)',
                              color: m.result === 'win' ? 'var(--riot-teal)' : 'var(--riot-red)',
                            }}
                          >
                            {m.result === 'win' ? 'VICTORY' : 'DEFEAT'}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                            {m.kills} / <span style={{ color: '#EF4444' }}>{m.deaths}</span> / {m.assists}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            CS: {m.cs} · KDA: {((m.kills + m.assists) / Math.max(1, m.deaths)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No recent League matches recorded yet. Launch League of Legends or click Refresh Stats to sync.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
