import React from 'react';
import { Minus, Square, X, Flame } from 'lucide-react';

interface TitlebarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ onMinimize, onMaximize, onClose }) => {
  return (
    <div className="window-titlebar">
      <div className="titlebar-brand">
        <div className="brand-icon-wrap">
          <Flame size={15} color="#FFFFFF" />
        </div>
        <span className="brand-title">Riot Account Switcher</span>
        <span className="brand-tag">VALORANT & LOL</span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            textTransform: 'uppercase',
            marginLeft: '4px',
          }}
          title="Active Testing Beta - Automated input may require occasional manual focus depending on display scaling"
        >
          Testing
        </span>
      </div>

      <div className="titlebar-controls">
        <button className="ctrl-btn" onClick={onMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="ctrl-btn" onClick={onMaximize} title="Maximize">
          <Square size={12} />
        </button>
        <button className="ctrl-btn btn-close" onClick={onClose} title="Close to Tray">
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
