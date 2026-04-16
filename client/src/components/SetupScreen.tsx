function SetupScreen({ setupDir, setSetupDir, saveSetup, setupSaving, setupError }: {
  setupDir: string;
  setSetupDir: (v: string) => void;
  saveSetup: () => void;
  setupSaving: boolean;
  setupError: string;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-panel)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}>
      <img src="/logo.png" alt="Hemingweight" style={{ width: 56, height: 56 }} />
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
        Welcome to Hemingweight
      </div>
      <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        Choose a folder where your projects will be stored.
        Each project you create will be a subfolder inside this directory.
      </div>
      <input
        type="text"
        value={setupDir}
        onChange={e => setSetupDir(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && setupDir) saveSetup(); }}
        autoFocus
        className="input-field-mono"
        style={{ width: 360, fontSize: 14 }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        e.g. ~/Developer, ~/Projects, ~/Documents/code
      </div>
      {setupError && (
        <div style={{ fontSize: 12, color: 'var(--error)' }}>{setupError}</div>
      )}
      <button
        onClick={saveSetup}
        disabled={!setupDir || setupSaving}
        className="btn-primary"
        style={{
          marginTop: 8, padding: '10px 32px', borderRadius: 8,
          fontSize: 14,
          background: setupDir ? undefined : 'var(--border-default)',
          cursor: setupDir ? 'pointer' : 'not-allowed',
        }}
      >
        {setupSaving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}

export default SetupScreen;
