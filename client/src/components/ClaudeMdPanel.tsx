function ClaudeMdPanel({
  claudeMd, claudeMdLoading, claudeMdEditing, claudeMdDraft, claudeMdSaving,
  setClaudeMdDraft, setClaudeMdEditing, saveClaudeMd, projectName,
}: {
  claudeMd: string | null;
  claudeMdLoading: boolean;
  claudeMdEditing: boolean;
  claudeMdDraft: string;
  claudeMdSaving: boolean;
  setClaudeMdDraft: (v: string) => void;
  setClaudeMdEditing: (v: boolean) => void;
  saveClaudeMd: () => void;
  projectName: string;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--bg-panel)',
      padding: '24px 48px',
      display: 'flex', flexDirection: 'column',
    }}>
      {claudeMdLoading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
      ) : claudeMdEditing ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <button
              onClick={saveClaudeMd}
              disabled={claudeMdSaving}
              className="btn-primary"
              style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12 }}
            >
              {claudeMdSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setClaudeMdEditing(false)}
              className="btn-outline"
              style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}
            >
              Cancel
            </button>
          </div>
          <textarea
            value={claudeMdDraft}
            onChange={e => setClaudeMdDraft(e.target.value)}
            autoFocus
            style={{
              flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-default)',
              borderRadius: 8, padding: 16, color: 'var(--text-primary)',
              fontFamily: "var(--font-mono-full)",
              fontSize: 13, lineHeight: '22px', resize: 'none', outline: 'none',
              maxWidth: 800,
            }}
          />
        </>
      ) : claudeMd ? (
        <>
          <div style={{ marginBottom: 12, flexShrink: 0 }}>
            <button
              onClick={() => { setClaudeMdDraft(claudeMd); setClaudeMdEditing(true); }}
              className="btn-outline"
              style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit
            </button>
          </div>
          <pre style={{
            margin: 0,
            fontFamily: "var(--font-mono-full)",
            fontSize: 13, lineHeight: '22px', color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxWidth: 800,
          }}>
            {claudeMd}
          </pre>
        </>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 12,
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No CLAUDE.md found in this project
          </div>
          <div style={{ fontSize: 12, color: 'var(--border-default)', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
            CLAUDE.md is a file at the root of your project that guides Claude Code — architecture, conventions, and key context.
          </div>
          <button
            onClick={() => {
              setClaudeMdDraft(`# ${projectName}\n\nDescribe your project here.\n`);
              setClaudeMdEditing(true);
            }}
            className="btn-primary"
            style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, fontSize: 13 }}
          >
            Create CLAUDE.md
          </button>
        </div>
      )}
    </div>
  );
}

export default ClaudeMdPanel;
