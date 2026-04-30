interface GitData {
  isGitRepo: boolean;
  files: { status: string; file: string }[];
  diff: string;
  diffStaged: string;
  log: string;
  remote?: string;
}

function IntegrationsDropdown({
  show, integrationSettings, setIntegrationSettings,
  gitData, supabaseConnected,
  supabaseUrl, setSupabaseUrl, supabaseAnonKey, setSupabaseAnonKey,
  supabaseServiceKey, setSupabaseServiceKey,
  supabaseConnecting, setSupabaseConnecting, supabaseConnectMsg, setSupabaseConnectMsg,
  setSupabaseConnected,
  gitRepoUrl, setGitRepoUrl, gitConnecting, setGitConnecting, gitConnectMsg, setGitConnectMsg,
  selectedProjectPath, setGitData,
  setRightPanel, setShowIntegrations,
}: {
  show: boolean;
  integrationSettings: string | null;
  setIntegrationSettings: (v: string | null) => void;
  gitData: GitData | null;
  supabaseConnected: boolean;
  supabaseUrl: string;
  setSupabaseUrl: (v: string) => void;
  supabaseAnonKey: string;
  setSupabaseAnonKey: (v: string) => void;
  supabaseServiceKey: string;
  setSupabaseServiceKey: (v: string) => void;
  supabaseConnecting: boolean;
  setSupabaseConnecting: (v: boolean) => void;
  supabaseConnectMsg: string;
  setSupabaseConnectMsg: (v: string) => void;
  setSupabaseConnected: (v: boolean) => void;
  gitRepoUrl: string;
  setGitRepoUrl: (v: string) => void;
  gitConnecting: boolean;
  setGitConnecting: (v: boolean) => void;
  gitConnectMsg: string;
  setGitConnectMsg: (v: string) => void;
  selectedProjectPath: string;
  setGitData: (v: GitData | null) => void;
  setRightPanel: (v: 'preview' | 'code' | 'claude' | 'git' | 'kanban') => void;
  setShowIntegrations: (v: boolean) => void;
}) {
  if (!show) return null;

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0,
      marginTop: 6, background: 'var(--bg-dropdown)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, zIndex: 100,
      boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      overflow: 'visible',
    }}>
      {/* Integration list */}
      <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Add integrations</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>Connect the tools you use to your project.</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {/* GitHub */}
          <button
            className="integration-item"
            onClick={() => setIntegrationSettings(integrationSettings === 'github' ? null : 'github')}
            style={{ background: integrationSettings === 'github' ? 'var(--bg-hover-soft)' : undefined }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="#000">
                <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>GitHub</div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Push, pull, and manage your repository.</div>
            </div>
            {gitData?.remote ? (
              <div className="badge-connected">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5L13 4" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Connected
              </div>
            ) : (
              <div style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)',
              }}>
                Connect
              </div>
            )}
          </button>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px' }} />

          {/* Supabase */}
          <button
            className="integration-item"
            onClick={() => setIntegrationSettings(integrationSettings === 'supabase' ? null : 'supabase')}
            style={{ background: integrationSettings === 'supabase' ? 'var(--bg-hover-soft)' : undefined }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 109 113" fill="none">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="#3ECF8E" />
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Supabase</div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Auth, database, and storage for your app.</div>
            </div>
            {supabaseConnected ? (
              <div className="badge-connected">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5L13 4" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Connected
              </div>
            ) : (
              <div style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)',
              }}>
                Connect
              </div>
            )}
          </button>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px' }} />

          {/* Vercel -- coming soon */}
          <div style={{
            width: '100%', padding: '12px',
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: 0.45,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="var(--text-primary)">
                <path d="M8 1L15.794 14.5H0.206L8 1Z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Vercel
                <span className="badge-soon">SOON</span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Deploy and host your frontend.</div>
            </div>
            <div style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
              background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
            }}>
              Connect
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px' }} />

          {/* Netlify -- coming soon */}
          <div style={{
            width: '100%', padding: '12px',
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: 0.45,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M8 1l7 13H1L8 1z" stroke="#3fb5a3" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Netlify
                <span className="badge-soon">SOON</span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Deploy and host with Netlify.</div>
            </div>
            <div style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
              background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
            }}>
              Connect
            </div>
          </div>
        </div>
      </div>

      {/* Settings side panel */}
      {integrationSettings && (
        <div style={{
          position: 'absolute', top: 0, left: '100%',
          width: 360, marginLeft: 6,
          background: 'var(--bg-dropdown)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', maxHeight: 420,
        }}>
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            {integrationSettings === 'github' && (
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#000">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </div>
            )}
            {integrationSettings === 'supabase' && (
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1c1c1c', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 109 113" fill="none">
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="#3ECF8E" />
                  <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
                </svg>
              </div>
            )}
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Integration settings</div>
            <button
              className="btn-close"
              onClick={() => setIntegrationSettings(null)}
              style={{ width: 26, height: 26, borderRadius: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>

          {integrationSettings === 'supabase' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Supabase</div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, marginBottom: 6 }}>
                Supabase gives your app a database, user login, and file storage.
              </div>

              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', background: '#222226', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>Where to find these:</div>
                1. Go to <span style={{ color: '#3ECF8E' }}>supabase.com</span> and sign in<br />
                2. Open your project (or create one)<br />
                3. Go to <span style={{ color: 'var(--text-primary)' }}>Settings {'\u2192'} API</span><br />
                4. Copy the <span style={{ color: 'var(--text-primary)' }}>Project URL</span> and <span style={{ color: 'var(--text-primary)' }}>anon public</span> key below
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Project URL</label>
                  {supabaseConnected && supabaseUrl && (
                    <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Connected
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>The URL of your Supabase project (starts with https://)</div>
                <input
                  type="text" placeholder="https://xxxxx.supabase.co"
                  value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)}
                  className="input-field-mono"
                  style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid var(--border-subtle)', borderRadius: 8, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Anon Key</label>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>The public key -- safe to use in your app's frontend code</div>
                <input
                  type="password" placeholder="eyJhbG..."
                  value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)}
                  className="input-field-mono"
                  style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid var(--border-subtle)', borderRadius: 8, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Service Role Key <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Only needed if your app has a backend/server. This key has full database access -- keep it secret.
                  Found in the same Settings {'\u2192'} API page, under "service_role".
                </div>
                <input
                  type="password" placeholder="eyJhbG... (leave blank if unsure)"
                  value={supabaseServiceKey || ''} onChange={e => setSupabaseServiceKey(e.target.value)}
                  className="input-field-mono"
                  style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid var(--border-subtle)', borderRadius: 8, boxSizing: 'border-box' }}
                />
              </div>

              <button
                onClick={() => {
                  if (!supabaseUrl || !supabaseAnonKey || !selectedProjectPath) return;
                  setSupabaseConnecting(true); setSupabaseConnectMsg('');
                  fetch('/api/supabase/connect', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProjectPath, supabaseUrl, supabaseAnonKey, supabaseServiceKey }),
                  })
                    .then(r => r.json())
                    .then(data => { if (data.error) setSupabaseConnectMsg(data.error); else { setSupabaseConnectMsg(data.message || 'Connected!'); setSupabaseConnected(true); } })
                    .catch(() => setSupabaseConnectMsg('Connection failed'))
                    .finally(() => setSupabaseConnecting(false));
                }}
                disabled={!supabaseUrl || !supabaseAnonKey || supabaseConnecting}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: (supabaseUrl && supabaseAnonKey) ? '#3ECF8E' : 'var(--border-default)',
                  color: (supabaseUrl && supabaseAnonKey) ? '#000' : '#71717a',
                  fontSize: 13, fontWeight: 600,
                  cursor: (supabaseUrl && supabaseAnonKey && !supabaseConnecting) ? 'pointer' : 'not-allowed',
                }}
              >
                {supabaseConnecting ? 'Connecting...' : supabaseConnected ? 'Update' : 'Connect'}
              </button>

              {supabaseConnectMsg && (
                <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginTop: 10, color: supabaseConnectMsg.toLowerCase().includes('fail') || supabaseConnectMsg.toLowerCase().includes('error') ? 'var(--error)' : 'var(--success)' }}>
                  {supabaseConnectMsg}
                </div>
              )}
            </div>
          )}

          {integrationSettings === 'github' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>GitHub</div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, marginBottom: 6 }}>
                GitHub saves your project's code online so you never lose it and can share it with others.
              </div>

              {gitData?.remote ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Repository</label>
                    <div style={{
                      padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      fontSize: 12, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex', alignItems: 'center', gap: 8,
                      wordBreak: 'break-all',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M3 8.5l3.5 3.5L13 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {gitData.remote}
                    </div>
                  </div>
                  <button
                    onClick={() => { setRightPanel('git'); setShowIntegrations(false); setIntegrationSettings(null); }}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                      background: 'var(--text-primary)', color: 'var(--bg-panel)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Open Git Panel
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', background: '#222226', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>How to get a repository URL:</div>
                    1. Go to <span style={{ color: 'var(--text-primary)' }}>github.com</span> and sign in<br />
                    2. Click the <span style={{ color: 'var(--text-primary)' }}>+</span> button (top right) {'\u2192'} <span style={{ color: 'var(--text-primary)' }}>New repository</span><br />
                    3. Give it a name and click <span style={{ color: 'var(--text-primary)' }}>Create repository</span><br />
                    4. Copy the URL from the page (ends in .git)
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Repository URL</label>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Paste the URL of your GitHub repository here</div>
                    <input
                      type="text"
                      id="github-repo-url"
                      name="github-repo-url"
                      placeholder="https://github.com/you/repo.git"
                      value={gitRepoUrl}
                      onChange={e => setGitRepoUrl(e.target.value)}
                      className="input-field-mono"
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', fontSize: 12 }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!gitRepoUrl || !selectedProjectPath || gitConnecting) return;
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
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                      background: gitRepoUrl ? 'var(--text-primary)' : 'var(--border-default)',
                      color: gitRepoUrl ? 'var(--bg-panel)' : '#71717a',
                      fontSize: 13, fontWeight: 600,
                      cursor: gitRepoUrl && !gitConnecting ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {gitConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                  {gitConnectMsg && (
                    <div style={{
                      fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginTop: 10,
                      color: gitConnectMsg.toLowerCase().includes('fail') || gitConnectMsg.toLowerCase().includes('error') ? 'var(--error)' : 'var(--success)',
                    }}>
                      {gitConnectMsg}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IntegrationsDropdown;
