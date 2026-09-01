import React from 'react';
import { Play, Flame, Shield, ShieldCheck, MoreVertical, Edit2, Trash2, RefreshCw, BarChart2, Coins, Sparkles, UserCheck } from 'lucide-react';
import { RiotAccount } from '../types';

interface AccountCardProps {
  account: RiotAccount;
  onLaunch: (accountId: string, game: 'valorant' | 'league') => void;
  onOpenDetails: (account: RiotAccount) => void;
  onEdit: (account: RiotAccount) => void;
  onDelete: (account: RiotAccount) => void;
  onRefresh: (account: RiotAccount) => void;
  isLaunching?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onLaunch,
  onOpenDetails,
  onEdit,
  onDelete,
  onRefresh,
  isLaunching,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const getRankColor = (rankStr?: string) => {
    if (!rankStr || rankStr === 'Unranked') return 'var(--text-muted)';
    if (rankStr.includes('Radiant')) return 'var(--val-radiant)';
    if (rankStr.includes('Immortal')) return 'var(--val-immortal)';
    if (rankStr.includes('Ascendant')) return 'var(--val-ascendant)';
    if (rankStr.includes('Diamond')) return 'var(--val-diamond)';
    if (rankStr.includes('Platinum')) return 'var(--val-plat)';
    if (rankStr.includes('Gold')) return 'var(--val-gold)';
    return 'var(--text-muted)';
  };

  const valLevel = account.valorantStats?.accountLevel || account.valorantStats?.battlePassLevel;
  const lolLevel = account.leagueStats?.summonerLevel;

  return (
    <div className="account-card" onClick={() => onOpenDetails(account)}>
      <div className="card-header" onClick={(e) => e.stopPropagation()}>
        <div className="card-avatar-wrap">
          <div className="card-avatar">
            {account.label.charAt(0).toUpperCase()}
            <span className={`game-dot-badge ${account.games === 'both' ? 'both' : account.games === 'valorant' ? 'val' : 'lol'}`} />
          </div>
          <div className="card-identity">
            <div className="account-label">
              <span>{account.label}</span>
              {(account.games === 'valorant' || account.games === 'both') && valLevel && valLevel > 1 && (
                <span className="level-tag" title="Valorant Account Level">
                  LVL {valLevel}
                </span>
              )}
              {(account.games === 'league' || account.games === 'both') && lolLevel && lolLevel > 1 && (
                <span className="level-tag lol" title="League Summoner Level">
                  LVL {lolLevel}
                </span>
              )}
            </div>
            <div className="account-riot-id">
              {account.riotId ? `${account.riotId}#${account.tagline || 'NA1'}` : account.username}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
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
                minWidth: '130px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                onClick={() => {
                  setShowMenu(false);
                  onEdit(account);
                }}
              >
                <Edit2 size={13} /> Edit
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                onClick={() => {
                  setShowMenu(false);
                  onRefresh(account);
                }}
              >
                <RefreshCw size={13} /> Refresh Stats
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--riot-red)' }}
                onClick={() => {
                  setShowMenu(false);
                  onDelete(account);
                }}
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Valorant Preview */}
        {(account.games === 'valorant' || account.games === 'both') && (
          <div className="rank-preview-box">
            <div className="rank-meta">
              <div className="rank-icon-pill" style={{ color: 'var(--riot-red)' }}>
                <Flame size={16} />
              </div>
              <div className="rank-titles">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="rank-game-label">VALORANT</span>
                  <span className="card-level-chip val">
                    LVL {account.valorantStats?.accountLevel || account.valorantStats?.battlePassLevel || 1}
                  </span>
                </div>
                <span className="rank-tier-name" style={{ color: getRankColor(account.valorantStats?.rank) }}>
                  {account.valorantStats?.rank || 'Unranked'}
                </span>
              </div>
            </div>
            {account.valorantStats && (
              <span className="rank-score-badge">
                {account.valorantStats.rankRating} RR
              </span>
            )}
          </div>
        )}

        {/* League of Legends Preview */}
        {(account.games === 'league' || account.games === 'both') && (
          <div className="rank-preview-box">
            <div className="rank-meta">
              <div className="rank-icon-pill" style={{ color: 'var(--riot-teal)' }}>
                <Shield size={16} />
              </div>
              <div className="rank-titles">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="rank-game-label">LEAGUE OF LEGENDS</span>
                  <span className="card-level-chip lol">
                    LVL {account.leagueStats?.summonerLevel || 1}
                  </span>
                </div>
                <span className="rank-tier-name" style={{ color: getRankColor(account.leagueStats?.soloRank) }}>
                  {account.leagueStats?.soloRank || 'Unranked'}
                </span>
              </div>
            </div>
            {account.leagueStats && (
              <span className="rank-score-badge" style={{ color: 'var(--hextech-gold)' }}>
                {account.leagueStats.soloLp} LP
              </span>
            )}
          </div>
        )}

        {/* Currency & Inventory Strip on Main Page */}
        <div className="stat-chip-row">
          {(account.games === 'valorant' || account.games === 'both') && account.valorantStats && (
            <>
              <span className="stat-chip accent-red" title="Valorant Points">
                <Coins size={11} /> {account.valorantStats.vpBalance.toLocaleString()} VP
              </span>
              <span className="stat-chip accent-teal" title="Radianite Points">
                <Sparkles size={11} /> {account.valorantStats.radianiteBalance} RAD
              </span>
              {account.valorantStats.kcBalance > 0 && (
                <span className="stat-chip" title="Kingdom Credits">
                  {account.valorantStats.kcBalance.toLocaleString()} KC
                </span>
              )}
              {account.valorantStats.skinsOwned !== undefined && account.valorantStats.skinsOwned > 0 && (
                <span className="stat-chip" title="Weapon Skins Owned">
                  {account.valorantStats.skinsOwned} Skins
                </span>
              )}
            </>
          )}

          {(account.games === 'league' || account.games === 'both') && account.leagueStats && (
            <>
              <span className="stat-chip accent-gold" title="Riot Points (RP)">
                <Coins size={11} /> {account.leagueStats.rpBalance.toLocaleString()} RP
              </span>
              <span className="stat-chip accent-teal" title="Blue Essence (BE)">
                <Sparkles size={11} /> {account.leagueStats.beBalance.toLocaleString()} BE
              </span>
              {account.leagueStats.championsOwned !== undefined && account.leagueStats.championsOwned > 0 && (
                <span className="stat-chip" title="Champions Owned">
                  <UserCheck size={11} /> {account.leagueStats.championsOwned} Champs
                </span>
              )}
              {account.leagueStats.skinsOwned !== undefined && account.leagueStats.skinsOwned > 0 && (
                <span className="stat-chip" title="Skins Owned">
                  {account.leagueStats.skinsOwned} Skins
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card-footer" onClick={(e) => e.stopPropagation()}>
        {(account.games === 'valorant' || account.games === 'both') && (
          <button
            className="btn btn-primary btn-play-game"
            onClick={() => onLaunch(account.id, 'valorant')}
            disabled={isLaunching}
            title="Switch account & Launch Valorant"
          >
            <Play size={13} fill="#FFF" />
            Play VAL
          </button>
        )}

        {(account.games === 'league' || account.games === 'both') && (
          <button
            className="btn btn-teal btn-play-game"
            onClick={() => onLaunch(account.id, 'league')}
            disabled={isLaunching}
            title="Switch account & Launch League of Legends"
          >
            <Play size={13} fill="#0A0A0A" />
            Play LoL
          </button>
        )}

        <button
          className="btn btn-secondary btn-icon"
          onClick={() => onOpenDetails(account)}
          title="View In-Depth Matches & Stats"
        >
          <BarChart2 size={15} />
        </button>
      </div>
    </div>
  );
};
