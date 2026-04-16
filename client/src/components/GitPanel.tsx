import CommitRow from './CommitRow';

interface GitData {
  isGitRepo: boolean;
  files: { status: string; file: string }[];
  diff: string;
  diffStaged: string;
  log: string;
  remote?: string;
}

function GitPanel({
  gitData, selectedProjectPath, gitRepoUrl, setGitRepoUrl,
  gitConnecting, setGitConnecting, gitConnectMsg, setGitConnectMsg,
  setGitData, gitPushing, setGitPushing, gitPushMsg, setGitPushMsg,
  gitHistory, setGitHistory, gitRestoring, setGitRestoring,
}: {
  gitData: GitData | null;
  selectedProjectPath: string;
  gitRepoUrl: string;
  setGitRepoUrl: (v: string) => void;
  gitConnecting: boolean;
  setGitConnecting: (v: boolean) => void;
  gitConnectMsg: string;
  setGitConnectMsg: (v: string) => void;
  setGitData: (v: GitData | null) => void;
  gitPushing: boolean;
  setGitPushing: (v: boolean) => void;
  gitPushMsg: string;
  setGitPushMsg: (v: string) => void;
  gitHistory: { hash: string; short: string; message: string; author: string; date: string }[];
  setGitHistory: (v: { hash: string; short: string; message: string; author: string; date: string }[]) => void;
  gitRestoring: string | null;
  setGitRestoring: (v: string | null) => void;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--bg-panel)',
      padding: '24px 32px',
    }}>
      {!gitData ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
      ) : (!gitData.isGitRepo || !gitData.remote) ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16,
        }}>
          <svg width="40" height="40" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3 }}>
            <circle cx="8" cy="3" r="1.5" stroke="white" strokeWidth="1.2" />
            <circle cx="8" cy="13" r="1.5" stroke="white" strokeWidth="1.2" />
            <circle cx="13" cy="8" r="1.5" stroke="white" strokeWidth="1.2" />
            <path d="M8 4.5v7M9.5 8H8" stroke="white" strokeWidth="1.2" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Connect to GitHub
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
            {gitData.isGitRepo
              ? 'This project has git but no remote. Paste a GitHub repo URL to connect.'
              : 'Create a repo on GitHub, then paste the URL here to connect this project.'}
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
            <input
              type="text"
              id="git-repo-url"
              name="git-repo-url"
              placeholder="https://github.com/you/repo.git"
              value={gitRepoUrl}
              onChange={e => setGitRepoUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && gitRepoUrl && selectedProjectPath) {
                  setGitConnecting(true); setGitConnectMsg('');
                  fetch('/api/git/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProjectPath, repoUrl: gitRepoUrl }),
                  }).then(r => r.json()).then(data => {
                    if (data.error) setGitConnectMsg(data.error);
                    else { setGitConnectMsg(data.message || 'Connected!'); setGitRepoUrl(''); }
                    fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                      .then(r => r.json()).then(setGitData).catch(() => {});
                  }).catch(() => setGitConnectMsg('Connection failed'))
                    .finally(() => setGitConnecting(false));
                }
              }}
              className="input-field-mono"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => {
                if (!gitRepoUrl || !selectedProjectPath) return;
                setGitConnecting(true); setGitConnectMsg('');
                fetch('/api/git/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectPath: selectedProjectPath, repoUrl: gitRepoUrl }),
                }).then(r => r.json()).then(data => {
                  if (data.error) setGitConnectMsg(data.error);
                  else { setGitConnectMsg(data.message || 'Connected!'); setGitRepoUrl(''); }
                  fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                    .then(r => r.json()).then(setGitData).catch(() => {});
                }).catch(() => setGitConnectMsg('Connection failed'))
                  .finally(() => setGitConnecting(false));
              }}
              disabled={!gitRepoUrl || gitConnecting}
              className="btn-primary"
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 13,
                cursor: gitRepoUrl && !gitConnecting ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {gitConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          {gitConnectMsg && (
            <div style={{
              fontSize: 12, maxWidth: 420, textAlign: 'center', lineHeight: 1.5,
              color: gitConnectMsg.includes('fail') || gitConnectMsg.includes('error') ? 'var(--error)' : 'var(--success)',
            }}>
              {gitConnectMsg}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 900 }}>
          {/* Push controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            {gitData.files.length > 0 && (
              <button
                onClick={() => {
                  if (!selectedProjectPath) return;
                  setGitPushing(true); setGitPushMsg('');
                  fetch('/api/git/commit-and-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProjectPath }),
                  }).then(r => r.json()).then(data => {
                    setGitPushMsg(data.error || 'Committed and pushed!');
                    fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                      .then(r => r.json()).then(setGitData).catch(() => {});
                  }).catch(() => setGitPushMsg('Push failed'))
                    .finally(() => setGitPushing(false));
                }}
                disabled={gitPushing}
                className="btn-primary"
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12,
                  cursor: gitPushing ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 12V3M5 5.5L8 2.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 14h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {gitPushing ? 'Pushing...' : 'Commit & Push'}
              </button>
            )}
            <button
              onClick={() => {
                if (!selectedProjectPath) return;
                setGitPushing(true); setGitPushMsg('');
                fetch('/api/git/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectPath: selectedProjectPath }),
                }).then(r => r.json()).then(data => {
                  setGitPushMsg(data.error || 'Pushed!');
                  fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                    .then(r => r.json()).then(setGitData).catch(() => {});
                }).catch(() => setGitPushMsg('Push failed'))
                  .finally(() => setGitPushing(false));
              }}
              disabled={gitPushing}
              className="btn-outline"
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: gitPushing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 12V3M5 5.5L8 2.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 14h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Push
            </button>
            {/* Refresh */}
            <button
              onClick={() => {
                if (!selectedProjectPath) return;
                fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                  .then(r => r.json()).then(setGitData).catch(() => {});
              }}
              className="btn-outline"
              style={{
                width: 32, height: 32, borderRadius: 8, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Refresh"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.8M13.5 2v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {gitPushMsg && (
              <span style={{
                fontSize: 12,
                color: gitPushMsg.includes('fail') || gitPushMsg.includes('error') || gitPushMsg.includes('Error') ? 'var(--error)' : 'var(--success)',
              }}>
                {gitPushMsg}
              </span>
            )}
          </div>

          {/* Remote info */}
          {gitData.remote && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
              {gitData.remote}
            </div>
          )}

          {/* Changed files */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Changed Files {gitData.files.length > 0 && <span style={{ color: 'var(--accent)' }}>({gitData.files.length})</span>}
            </div>
            {gitData.files.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No changes</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {gitData.files.map(f => (
                  <div key={f.file} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 8px', borderRadius: 4,
                    fontSize: 13, fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{
                      width: 18, textAlign: 'center', fontSize: 11, fontWeight: 700,
                      color: f.status === 'M' ? 'var(--warning)' : f.status === 'A' || f.status === '?' ? 'var(--success)' : f.status === 'D' ? 'var(--error)' : 'var(--text-tertiary)',
                    }}>
                      {f.status === '?' ? 'N' : f.status}
                    </span>
                    <span style={{ color: '#c4c4d4' }}>{f.file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diff */}
          {(gitData.diff || gitData.diffStaged) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Diff</div>
              <pre style={{
                margin: 0, padding: 16, background: 'var(--bg-code)', borderRadius: 8,
                border: '1px solid var(--border-subtle)', overflow: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                lineHeight: '18px', whiteSpace: 'pre',
              }}>
                {(gitData.diffStaged + '\n' + gitData.diff).split('\n').map((line, i) => (
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
                      ? { color: '#71717a' } : undefined
                  }>
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}

          {/* Commit history */}
          {gitHistory.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {gitHistory.map((commit, i) => (
                  <CommitRow
                    key={commit.hash}
                    commit={commit}
                    isCurrent={i === 0}
                    projectPath={selectedProjectPath}
                    restoring={gitRestoring === commit.hash}
                    onRestore={() => {
                      if (!selectedProjectPath || gitRestoring) return;
                      setGitRestoring(commit.hash);
                      fetch('/api/git/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath: selectedProjectPath, hash: commit.hash }),
                      }).then(r => r.json()).then(data => {
                        if (data.error) { setGitPushMsg(data.error); }
                        else { setGitPushMsg('Restored!'); }
                        fetch(`/api/git/diff?path=${encodeURIComponent(selectedProjectPath)}`)
                          .then(r => r.json()).then(setGitData).catch(() => {});
                        fetch(`/api/git/history?path=${encodeURIComponent(selectedProjectPath)}`)
                          .then(r => r.json()).then(d => setGitHistory(d.commits || [])).catch(() => {});
                      }).catch(() => setGitPushMsg('Restore failed'))
                        .finally(() => setGitRestoring(null));
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GitPanel;
