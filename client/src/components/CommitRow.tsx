import { useState } from 'react';

function CommitRow({ commit, isCurrent, projectPath, restoring, onRestore, onView }: {
  commit: { hash: string; short: string; message: string; date: string };
  isCurrent: boolean;
  projectPath: string;
  restoring: boolean;
  onRestore: () => void;
  onView?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [diffData, setDiffData] = useState<{ files: { status: string; file: string }[]; diff: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
    if (!expanded && !diffData) {
      setLoading(true);
      fetch(`/api/git/commit-diff?path=${encodeURIComponent(projectPath)}&hash=${commit.hash}`)
        .then(r => r.json())
        .then(setDiffData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    setExpanded(e => !e);
  };

  return (
    <div style={{
      borderRadius: 6,
      background: isCurrent ? 'var(--accent-bg)' : 'transparent',
      borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', cursor: 'pointer',
      }} onClick={toggle}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
          flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
        }}>
          <path d="M3 1.5l4 3.5-4 3.5" stroke="#555570" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isCurrent ? 'var(--accent)' : 'var(--border-default)',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: 'var(--text-primary)', fontWeight: isCurrent ? 600 : 400,
            lineHeight: 1.4,
          }}>
            {commit.message}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{commit.short}</span>
            {' \u00b7 '}
            {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {!isCurrent && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onView && (
              <button
                className="commit-btn-view"
                onClick={(e) => { e.stopPropagation(); onView(); }}
              >
                View
              </button>
            )}
            <button
              className="commit-btn-restore"
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              disabled={restoring}
            >
              {restoring ? 'Restoring...' : 'Restore'}
            </button>
          </div>
        )}
        {isCurrent && (
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>CURRENT</span>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '0 12px 12px 42px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
          ) : diffData ? (
            <>
              {diffData.files.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {diffData.files.map(f => (
                    <div key={f.file} style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)',
                      display: 'flex', gap: 8, padding: '2px 0',
                    }}>
                      <span style={{
                        width: 14, textAlign: 'center', fontWeight: 700, fontSize: 11,
                        color: f.status === 'M' ? 'var(--warning)' : f.status === 'A' ? 'var(--success)' : f.status === 'D' ? 'var(--error)' : 'var(--text-tertiary)',
                      }}>
                        {f.status}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{f.file}</span>
                    </div>
                  ))}
                </div>
              )}
              {diffData.diff && (
                <pre style={{
                  margin: 0, padding: 12, background: 'var(--bg-code)', borderRadius: 6,
                  border: '1px solid var(--border-subtle)', overflow: 'auto',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  lineHeight: '16px', whiteSpace: 'pre', maxHeight: 400,
                }}>
                  {diffData.diff.split('\n').map((line, i) => (
                    <div key={i} className={
                      line.startsWith('+') && !line.startsWith('+++') ? 'diff-line-add' :
                      line.startsWith('-') && !line.startsWith('---') ? 'diff-line-remove' :
                      line.startsWith('@@') ? 'diff-line-header' :
                      line.startsWith('diff') ? 'diff-line-info' : ''
                    } style={
                      !(line.startsWith('+') && !line.startsWith('+++')) &&
                      !(line.startsWith('-') && !line.startsWith('---')) &&
                      !line.startsWith('@@') &&
                      !line.startsWith('diff')
                        ? { color: 'var(--text-muted)' } : undefined
                    }>
                      {line}
                    </div>
                  ))}
                </pre>
              )}
              {!diffData.diff && diffData.files.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No changes in this commit</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Could not load diff</div>
          )}
        </div>
      )}
    </div>
  );
}

export default CommitRow;
