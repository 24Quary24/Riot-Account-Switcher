import React from 'react';
import { ShieldCheck, Flame, Zap, Command, Lock, KeyRound } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--riot-red), #991B1B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--glow-red)',
          }}
        >
          <Flame size={32} color="#FFF" />
        </div>
        <div>
          <h2 style={{ fontSize: '22px', color: '#FFF' }}>Riot Client Wrapper & Switcher</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '13px', color: 'var(--riot-teal)', fontWeight: 700 }}>Version 1.0.0</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>· Electron + React + TypeScript</span>
          </div>
        </div>
      </div>

      {/* Security Architecture Card */}
      <div className="stat-box" style={{ padding: '20px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="var(--riot-teal)" />
          <h3 style={{ fontSize: '15px', color: '#FFF' }}>Bank-Grade Credential Security</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          This application never stores passwords in plain text. On Windows, credentials are protected by{' '}
          <strong>Electron safeStorage</strong> which binds to the Windows Data Protection API (<strong>DPAPI</strong>)
          tied to your hardware and user profile.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--riot-teal)' }}>
              <Lock size={14} /> Zero Log Retention
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Passwords and API tokens are never written to disk logs, telemetry, or remote servers.
            </p>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--hextech-gold)' }}>
              <KeyRound size={14} /> AES-256 Backups
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Vault exports use PBKDF2 key stretching (100k rounds) with authenticated AES-256-GCM.
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="stat-box" style={{ padding: '20px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Command size={18} color="var(--hextech-gold)" />
          <h3 style={{ fontSize: '15px', color: '#FFF' }}>Keyboard Shortcuts</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add New Account</span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>Ctrl + N</kbd>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Refresh Stats</span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>Ctrl + R</kbd>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Quick Switch Account</span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>Ctrl + 1..9</kbd>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Open Settings</span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>Ctrl + ,</kbd>
          </div>
        </div>
      </div>

      {/* Credits & AI Collaboration */}
      <div className="stat-box" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '4px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>Created & Maintained by 24Quary24</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Engineered in collaboration with Google DeepMind's Gemini AI assistant.
          </div>
        </div>
        <span className="stat-chip accent-teal" style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700 }}>
          AI Augmented Project
        </span>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.6', marginTop: '12px' }}>
        <strong>Disclaimer:</strong> This application is a third-party account manager and is not endorsed by, directly affiliated with, or sponsored by Riot Games, Inc. VALORANT and League of Legends are trademarks or registered trademarks of Riot Games, Inc.
      </div>
    </div>
  );
};
