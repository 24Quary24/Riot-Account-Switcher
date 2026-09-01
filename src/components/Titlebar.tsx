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
        <span className="brand-title">Riot Client Wrapper</span>
        <span className="brand-tag">VALORANT & LOL</span>
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
