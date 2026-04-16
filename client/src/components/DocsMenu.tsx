function DocsMenu({ show, onClose }: {
  show: boolean;
  onClose: () => void;
}) {
  if (!show) return null;

  return (
    <div className="dropdown-panel" style={{
      position: 'absolute', top: '100%', right: 0,
      marginTop: 6,
      minWidth: 220, padding: '6px',
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
    </div>
  );
}

export default DocsMenu;
