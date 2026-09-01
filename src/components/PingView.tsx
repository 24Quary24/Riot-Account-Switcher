import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw, Zap, Server } from 'lucide-react';
import { PingResult } from '../types';

interface PingViewProps {
  onFetchPing: () => Promise<PingResult[]>;
}

export const PingView: React.FC<PingViewProps> = ({ onFetchPing }) => {
  const [results, setResults] = useState<PingResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runPingCheck = async () => {
    setLoading(true);
    try {
      const data = await onFetchPing();
      setResults(data);
    } catch (err) {
      console.error('Ping check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPingCheck();
  }, []);

  const bestRegion = results.length > 0
    ? [...results].sort((a, b) => a.pingMs - b.pingMs)[0]
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', color: '#FFF' }}>Riot Regional Server Latency</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Live round-trip response times to official Riot Games regional game server clusters.
          </p>
        </div>

        <button className="btn btn-primary" onClick={runPingCheck} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          {loading ? 'Measuring Latency...' : 'Refresh Ping'}
        </button>
      </div>

      {bestRegion && bestRegion.status !== 'offline' && (
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(90deg, rgba(0, 178, 169, 0.15), rgba(200, 170, 110, 0.1))',
            border: '1px solid rgba(0, 178, 169, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={20} color="var(--riot-teal)" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
                Optimal Server: {bestRegion.regionName} ({bestRegion.region})
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Lowest latency detected at {bestRegion.city}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--riot-teal)' }}>
            {bestRegion.pingMs} ms
          </div>
        </div>
      )}

      <div className="ping-grid">
        {results.map((item) => (
          <div key={item.region} className="ping-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Server size={18} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFF' }}>
                    {item.region}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {item.regionName}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {item.city}
                </div>
              </div>
            </div>

            <div className="ping-indicator">
              <span className={`ping-dot ${item.status}`} />
              <span
                style={{
                  color:
                    item.status === 'good'
                      ? '#10B981'
                      : item.status === 'medium'
                      ? '#F59E0B'
                      : '#EF4444',
                }}
              >
                {item.status === 'offline' ? 'Offline' : `${item.pingMs} ms`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
