interface DocsMenuVersion {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

function DocsMenu({ show, onClose, version, onUpdate }: {
  show: boolean;
  onClose: () => void;
  version?: DocsMenuVersion | null;
  onUpdate?: () => void;
}) {
  if (!show) return null;

  return (
    <div className="dropdown-panel" style={{
      position: 'absolute', top: '100%', right: 0,
      marginTop: 6,
      minWidth: 240, padding: '6px',
    }}>
      <button
        className="dropdown-item"
        onClick={() => { window.open('/site/', '_blank'); onClose(); }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 2h12v12H2z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Landing Page
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
          <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 8px' }} />

      <button
        className="dropdown-item"
        onClick={() => { window.open('/docs', '_blank'); onClose(); }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 3c1.5-1 3.5-1 5 0v10c-1.5-1-3.5-1-5 0V3zM15 3c-1.5-1-3.5-1-5 0v10c1.5-1 3.5-1 5 0V3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 3v10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Documentation
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
          <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {version && (
        <>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 8px' }} />
          <div style={{
            padding: '8px 10px 6px',
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Hemingweight</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>v{version.current}</span>
            {version.updateAvailable && version.latest && (
              <button
                onClick={() => { if (onUpdate) onUpdate(); onClose(); }}
                style={{
                  marginLeft: 'auto',
                  background: 'var(--accent-bg-strong)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  padding: '2px 8px', borderRadius: 5,
                  fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                title={`Update to v${version.latest}`}
              >
                v{version.latest} available
              </button>
            )}
            {!version.updateAvailable && version.latest && (
              <span style={{ marginLeft: 'auto', color: 'var(--success)', fontSize: 10 }} title="You're on the latest">
                latest
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DocsMenu;
