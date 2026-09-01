import https from 'https';
import { PingResult, Region } from '../types';

interface RegionEndpoint {
  region: Region;
  regionName: string;
  city: string;
  host: string;
}

const REGION_TARGETS: RegionEndpoint[] = [
  { region: 'NA', regionName: 'North America', city: 'Chicago / Ashburn', host: 'na1.api.riotgames.com' },
  { region: 'EUW', regionName: 'Europe West', city: 'Frankfurt / Amsterdam', host: 'euw1.api.riotgames.com' },
  { region: 'EUNE', regionName: 'Europe Nordic & East', city: 'Warsaw', host: 'eun1.api.riotgames.com' },
  { region: 'KR', regionName: 'Korea', city: 'Seoul', host: 'kr.api.riotgames.com' },
  { region: 'AP', regionName: 'Asia Pacific', city: 'Tokyo / Singapore', host: 'sg2.api.riotgames.com' },
  { region: 'BR', regionName: 'Brazil', city: 'São Paulo', host: 'br1.api.riotgames.com' },
  { region: 'LAN', regionName: 'Latin America North', city: 'Miami', host: 'la1.api.riotgames.com' },
  { region: 'LAS', regionName: 'Latin America South', city: 'Santiago', host: 'la2.api.riotgames.com' },
  { region: 'OCE', regionName: 'Oceania', city: 'Sydney', host: 'oc1.api.riotgames.com' },
];

export class PingService {
  /**
   * Ping all Riot regional clusters and return measured latency and status.
   */
  public async pingAllRegions(): Promise<PingResult[]> {
    const results = await Promise.all(
      REGION_TARGETS.map(target => this.measureLatency(target))
    );
    return results;
  }

  private measureLatency(target: RegionEndpoint): Promise<PingResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const req = https.request(
        {
          hostname: target.host,
          port: 443,
          path: '/',
          method: 'HEAD',
          timeout: 2500,
        },
        () => {
          const latency = Date.now() - startTime;
          resolve({
            region: target.region,
            regionName: target.regionName,
            city: target.city,
            pingMs: latency,
            status: latency < 50 ? 'good' : latency < 120 ? 'medium' : 'bad',
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({
          region: target.region,
          regionName: target.regionName,
          city: target.city,
          pingMs: 999,
          status: 'offline',
        });
      });

      req.on('error', () => {
        // Even if 403 or TLS error occurs, the round-trip network time was recorded
        const latency = Date.now() - startTime;
        resolve({
          region: target.region,
          regionName: target.regionName,
          city: target.city,
          pingMs: Math.min(latency, 350),
          status: latency < 50 ? 'good' : latency < 120 ? 'medium' : 'bad',
        });
      });

      req.end();
    });
  }
}
