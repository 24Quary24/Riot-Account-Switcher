import React, { useState } from 'react';
import { X, Lock, Download, Upload, ShieldCheck, Check, Copy } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (passphrase: string) => Promise<string>;
  onImport: (bundleJson: string, passphrase: string) => Promise<{ importedCount: number }>;
  onNotify: (title: string, desc: string, type: 'success' | 'error' | 'info') => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
  onNotify,
}) => {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [importJson, setImportJson] = useState('');
  const [exportedResult, setExportedResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 6) {
      onNotify('Passphrase Too Short', 'Master passphrase must be at least 6 characters.', 'error');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      onNotify('Mismatch', 'Passphrases do not match.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const encryptedData = await onExport(passphrase);
      setExportedResult(encryptedData);
      onNotify('Export Generated', 'Your account vault has been encrypted with AES-256.', 'success');
    } catch (err: any) {
      onNotify('Export Failed', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJson.trim()) {
      onNotify('Empty Data', 'Please paste the encrypted backup JSON bundle.', 'error');
      return;
    }
    if (!passphrase) {
      onNotify('Passphrase Required', 'Please enter the passphrase used to encrypt this backup.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await onImport(importJson, passphrase);
      onNotify('Import Complete', `Successfully imported ${res.importedCount} accounts!`, 'success');
      onClose();
    } catch (err: any) {
      onNotify('Import Failed', err.message || 'Incorrect passphrase or corrupted file.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([exportedResult], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riot-accounts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="var(--riot-teal)" />
            <h3 style={{ fontSize: '16px', color: '#FFF' }}>Encrypted Account Vault</h3>
          </div>
          <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}>
          <button
            className={`nav-tab-btn ${tab === 'export' ? 'active' : ''}`}
            style={{ flex: 1, borderRadius: 0, justifyContent: 'center', padding: '10px' }}
            onClick={() => setTab('export')}
          >
            <Download size={14} /> Export Backup
          </button>
          <button
            className={`nav-tab-btn ${tab === 'import' ? 'active' : ''}`}
            style={{ flex: 1, borderRadius: 0, justifyContent: 'center', padding: '10px' }}
            onClick={() => setTab('import')}
          >
            <Upload size={14} /> Import Backup
          </button>
        </div>

        <div className="modal-body">
          {tab === 'export' ? (
            !exportedResult ? (
              <form onSubmit={handleExport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Create an encrypted, password-protected archive of all your saved Riot accounts. All credentials are encrypted with <strong>AES-256-GCM</strong> using your passphrase.
                </p>

                <div className="form-group">
                  <label className="form-label">Vault Master Passphrase</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter strong passphrase (min 6 chars)"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Passphrase</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Repeat passphrase"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-footer" style={{ margin: '8px -24px -24px -24px' }}>
                  <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                    {isProcessing ? 'Encrypting...' : 'Generate Encrypted Backup'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--riot-teal)' }}>
                  <ShieldCheck size={18} />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Vault Encrypted Successfully</span>
                </div>

                <textarea
                  readOnly
                  className="form-input"
                  style={{ height: '140px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                  value={exportedResult}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCopyExport}>
                    {copied ? <Check size={14} color="var(--riot-teal)" /> : <Copy size={14} />}
                    {copied ? 'Copied to Clipboard' : 'Copy Backup Text'}
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDownloadFile}>
                    <Download size={14} /> Download .json
                  </button>
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Paste the contents of your encrypted backup JSON bundle below and supply the master passphrase to restore your accounts.
              </p>

              <div className="form-group">
                <label className="form-label">Encrypted JSON Content</label>
                <textarea
                  className="form-input"
                  placeholder='Paste {"magic": "RIOT_MGR_VAULT", ...}'
                  style={{ height: '120px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Decryption Passphrase</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter the passphrase used during export"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer" style={{ margin: '8px -24px -24px -24px' }}>
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'Decrypting & Merging...' : 'Restore Accounts'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
