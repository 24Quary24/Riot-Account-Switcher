export type GameType = 'valorant' | 'league' | 'both';

export type Region = 'NA' | 'EUW' | 'EUNE' | 'KR' | 'AP' | 'BR' | 'LAN' | 'LAS' | 'OCE';

export interface ValorantMatch {
  id: string;
  map: string;
  gameMode: string;
  agent: string;
  agentIcon?: string;
  kills: number;
  deaths: number;
  assists: number;
  result: 'win' | 'loss' | 'draw';
  score: string;
  playedAt: string;
  headshotPct?: number;
}

export interface ChampionMastery {
  championName: string;
  championIcon: string;
  championLevel: number;
  championPoints: number;
}

export interface LeagueMatch {
  id: string;
  champion: string;
  championIcon: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: 'win' | 'loss';
  gameMode: string;
  playedAt: string;
  cs: number;
}

export interface ValorantStats {
  accountLevel: number;
  rank: string;
  rankRating: number;
  peakRank: string;
  leaderboardPosition?: number | null;
  battlePassLevel: number;
  vpBalance: number;
  radianiteBalance: number;
  kcBalance: number; // Kingdom Credits
  skinsOwned?: number;
  agentsUnlocked?: number;
  recentMatches: ValorantMatch[];
}

export interface LeagueStats {
  summonerLevel: number;
  championsOwned?: number;
  skinsOwned?: number;
  soloRank: string;
  soloLp: number;
  soloWins?: number;
  soloLosses?: number;
  soloWinrate?: number;
  flexRank: string;
  flexLp: number;
  topMastery: ChampionMastery[];
  recentMatches: LeagueMatch[];
  rpBalance: number;
  beBalance: number;
}

export interface RiotAccount {
  id: string;
  label: string;
  username: string;
  region: Region;
  games: GameType;
  riotId: string;
  tagline: string;
  avatarUrl?: string;
  has2fa?: boolean;
  createdAt: string;
  lastPlayed?: string;
  valorantStats?: ValorantStats;
  leagueStats?: LeagueStats;
}

export interface AppSettings {
  riotClientPath: string;
  customPathEnabled: boolean;
  riotApiKey: string;
  autoCloseClients: boolean;
  autoLaunchGame: boolean;
  launchDelaySeconds: number;
  minimizeToTray: boolean;
  startMinimized: boolean;
  theme: 'dark' | 'amoled' | 'light';
  soundEffects: boolean;
}

export interface PingResult {
  region: Region;
  regionName: string;
  city: string;
  pingMs: number;
  status: 'good' | 'medium' | 'bad' | 'offline';
}

export interface FriendItem {
  id: string;
  riotId: string;
  tagline: string;
  status: 'online' | 'in-game' | 'away' | 'offline';
  game?: 'valorant' | 'league' | 'mobile';
  activity?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}
