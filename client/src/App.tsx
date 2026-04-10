import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import CodeViewer from './CodeViewer';

interface Project {
  name: string;
  path: string;
}

const isEmbed = new URLSearchParams(window.location.search).has('embed');

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
      background: isCurrent ? 'rgba(224,122,75,0.08)' : 'transparent',
      borderLeft: isCurrent ? '3px solid #e07a4b' : '3px solid transparent',
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
          background: isCurrent ? '#e07a4b' : '#3f3f46',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: '#e4e4ef', fontWeight: isCurrent ? 600 : 400,
            lineHeight: 1.4,
          }}>
            {commit.message}
          </div>
          <div style={{ fontSize: 11, color: '#555570', marginTop: 2 }}>
            <span style={{ fontFamily: "'SF Mono', Menlo, monospace" }}>{commit.short}</span>
            {' · '}
            {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {!isCurrent && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onView && (
              <button
                onClick={(e) => { e.stopPropagation(); onView(); }}
                style={{
                  padding: '4px 10px', borderRadius: 5,
                  border: '1px solid #3f3f46', background: 'transparent',
                  color: '#71717a', fontSize: 11, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#60a5fa'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#71717a'; }}
              >
                View
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              disabled={restoring}
              style={{
                padding: '4px 10px', borderRadius: 5,
                border: '1px solid #3f3f46', background: 'transparent',
                color: '#71717a', fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#e07a4b'; e.currentTarget.style.color = '#e07a4b'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#71717a'; }}
            >
              {restoring ? 'Restoring...' : 'Restore'}
            </button>
          </div>
        )}
        {isCurrent && (
          <span style={{ fontSize: 10, color: '#e07a4b', fontWeight: 600, flexShrink: 0 }}>CURRENT</span>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '0 12px 12px 42px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#555570' }}>Loading...</div>
          ) : diffData ? (
            <>
              {diffData.files.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {diffData.files.map(f => (
                    <div key={f.file} style={{
                      fontSize: 12, fontFamily: "'SF Mono', Menlo, monospace",
                      display: 'flex', gap: 8, padding: '2px 0',
                    }}>
                      <span style={{
                        width: 14, textAlign: 'center', fontWeight: 700, fontSize: 11,
                        color: f.status === 'M' ? '#fbbf24' : f.status === 'A' ? '#4ade80' : f.status === 'D' ? '#f87171' : '#a1a1aa',
                      }}>
                        {f.status}
                      </span>
                      <span style={{ color: '#a1a1aa' }}>{f.file}</span>
                    </div>
                  ))}
                </div>
              )}
              {diffData.diff && (
                <pre style={{
                  margin: 0, padding: 12, background: '#0f0f13', borderRadius: 6,
                  border: '1px solid #2a2a3a', overflow: 'auto',
                  fontFamily: "'SF Mono', Menlo, monospace", fontSize: 11,
                  lineHeight: '16px', whiteSpace: 'pre', maxHeight: 400,
                }}>
                  {diffData.diff.split('\n').map((line, i) => (
                    <div key={i} style={{
                      color: line.startsWith('+') && !line.startsWith('+++') ? '#4ade80' :
                             line.startsWith('-') && !line.startsWith('---') ? '#f87171' :
                             line.startsWith('@@') ? '#60a5fa' :
                             line.startsWith('diff') ? '#e07a4b' : '#555570',
                    }}>
                      {line}
                    </div>
                  ))}
                </pre>
              )}
              {!diffData.diff && diffData.files.length === 0 && (
                <div style={{ fontSize: 12, color: '#555570' }}>No changes in this commit</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#555570' }}>Could not load diff</div>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [chatOpen, setChatOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'running' | 'exited'>('idle');
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [rightPanel, setRightPanel] = useState<'preview' | 'code' | 'claude' | 'git'>('preview');
  const [claudeMd, setClaudeMd] = useState<string | null>(null);
  const [claudeMdLoading, setClaudeMdLoading] = useState(false);
  const [claudeMdEditing, setClaudeMdEditing] = useState(false);
  const [claudeMdDraft, setClaudeMdDraft] = useState('');
  const [claudeMdSaving, setClaudeMdSaving] = useState(false);
  const [gitData, setGitData] = useState<{ isGitRepo: boolean; files: { status: string; file: string }[]; diff: string; diffStaged: string; log: string; remote?: string } | null>(null);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitConnecting, setGitConnecting] = useState(false);
  const [gitConnectMsg, setGitConnectMsg] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectError, setNewProjectError] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const errorCountRef = useRef(0);
  const [pages, setPages] = useState<{ path: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState('/');
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [supabaseConnecting, setSupabaseConnecting] = useState(false);
  const [supabaseConnectMsg, setSupabaseConnectMsg] = useState('');
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [integrationSettings, setIntegrationSettings] = useState<string | null>(null);
  const [showDocsMenu, setShowDocsMenu] = useState(false);
  const [gitPushing, setGitPushing] = useState(false);
  const [gitPushMsg, setGitPushMsg] = useState('');
  const [gitHistory, setGitHistory] = useState<{ hash: string; short: string; message: string; author: string; date: string }[]>([]);
  const [gitRestoring, setGitRestoring] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCommits, setHistoryCommits] = useState<{ hash: string; short: string; message: string; author: string; date: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState<{ hash: string; short: string; message: string } | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const integrationsRef = useRef<HTMLDivElement>(null);
  const docsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside (including iframe clicks via blur)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showPageDropdown && pageDropdownRef.current && !pageDropdownRef.current.contains(e.target as Node)) {
        setShowPageDropdown(false);
      }
      if (showProjectPicker && projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
      }
      if (showIntegrations && integrationsRef.current && !integrationsRef.current.contains(e.target as Node)) {
        setShowIntegrations(false);
      }
      if (showDocsMenu && docsMenuRef.current && !docsMenuRef.current.contains(e.target as Node)) {
        setShowDocsMenu(false);
      }
    };
    const blurHandler = () => {
      // Window loses focus when iframe is clicked
      if (showPageDropdown) setShowPageDropdown(false);
      if (showProjectPicker) setShowProjectPicker(false);
      if (showIntegrations) setShowIntegrations(false);
      if (showDocsMenu) setShowDocsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('blur', blurHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('blur', blurHandler);
    };
  }, [showPageDropdown, showProjectPicker, showIntegrations, showDocsMenu]);

  // Fetch projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {});
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#18181b',
        foreground: '#e4e4ef',
        cursor: '#e07a4b',
        cursorAccent: '#18181b',
        selectionBackground: 'rgba(224, 122, 75, 0.3)',
        black: '#1a1a2e',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#d4956a',
        cyan: '#22d3ee',
        white: '#e4e4ef',
        brightBlack: '#555570',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#93bbfd',
        brightMagenta: '#e0b090',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);
    setTimeout(() => fitAddon.fit(), 50);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => setTimeout(() => fitAddon.fit(), 50);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Auto-refresh preview when files change
  useEffect(() => {
    if (!selectedProject || !previewRunning) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/files?path=${encodeURIComponent(selectedProject.path)}`);
    let debounce: ReturnType<typeof setTimeout> | null = null;

    ws.onmessage = () => {
      // Debounce: wait 800ms after last change before refreshing
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        setPreviewKey(k => k + 1);
      }, 800);
    };

    return () => {
      if (debounce) clearTimeout(debounce);
      ws.close();
    };
  }, [selectedProject, previewRunning]);

  // Auto-launch preview when project is selected
  useEffect(() => {
    if (!selectedProject || previewRunning || previewLoading) return;
    launchPreview();
  }, [selectedProject]);

  // Refit terminal when chat panel toggles
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Wait for CSS transition to fully complete, then refit multiple times
    // to ensure xterm recalculates dimensions correctly
    for (const delay of [50, 150, 300, 400, 500]) {
      timers.push(setTimeout(() => {
        if (chatOpen && fitAddonRef.current) {
          fitAddonRef.current.fit();
          termRef.current?.refresh(0, termRef.current.rows - 1);
        }
      }, delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [chatOpen]);

  const connectToProject = useCallback((project: Project) => {
    // Always clear preview state when switching projects
    if (selectedProject && selectedProject.path !== project.path) {
      fetch(`/api/preview/stop-all`, { method: 'POST' }).catch(() => {});
      setPreviewRunning(false);
      setPreviewUrl('');
    }

    setSelectedProject(project);
    setShowProjectPicker(false);
    setCurrentPage('/');
    setShowPageDropdown(false);
    setStatus('connecting');
    setErrorCount(0);
    errorCountRef.current = 0;

    if (wsRef.current) wsRef.current.close();

    const term = termRef.current;
    if (term) {
      term.clear();
      term.writeln(`\x1b[38;2;224;122;75m  Connecting to: ${project.name}\x1b[0m`);
      term.writeln(`\x1b[38;5;60m  ${project.path}\x1b[0m\r\n`);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${protocol}//${wsHost}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('running');
      const cols = term?.cols || 120;
      const rows = term?.rows || 40;
      ws.send(JSON.stringify({ type: 'start', cwd: project.path, cols, rows }));

      term?.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
      term?.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        term?.write(msg.data);
        // Error detection: look for common error patterns in output
        const plain = msg.data.replace(/\x1b\[[0-9;]*m/g, '');
        if (/\b(error|Error|ERROR|failed|FAILED|exception|Exception)\b/.test(plain) &&
            !/\b(0 errors?|no errors?)\b/i.test(plain)) {
          errorCountRef.current += 1;
          setErrorCount(errorCountRef.current);
        }
      }
      if (msg.type === 'exit') {
        setStatus('exited');
        term?.writeln('\r\n\x1b[38;5;60m  Session ended.\x1b[0m');
      }
    };

    ws.onclose = () => {
      setStatus(prev => prev === 'running' ? 'exited' : prev);
    };
    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setStatus('idle');
      term?.writeln('\r\n\x1b[31m  Connection error.\x1b[0m');
    };
  }, [selectedProject, previewRunning]);

  const launchPreview = useCallback(async () => {
    if (!selectedProject) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const resp = await fetch(`/api/preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: selectedProject.path }),
      });
      const data = await resp.json();
      if (data.error) {
        setPreviewError(data.error);
      } else if (data.ready && data.url) {
        setPreviewUrl(data.url);
        setPreviewRunning(true);
        setRightPanel('preview');
        setPreviewKey(k => k + 1);
      }
    } catch (err) {
      setPreviewError(`Failed to start preview: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedProject]);

  const stopPreview = useCallback(async () => {
    if (!selectedProject) return;
    setPreviewRunning(false);
    setPreviewUrl('');
    try {
      await fetch(`/api/preview/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: selectedProject.path }),
      });
    } catch {}
  }, [selectedProject]);

  // Fetch pages when project changes
  useEffect(() => {
    if (!selectedProject) { setPages([]); return; }
    fetch(`/api/pages?path=${encodeURIComponent(selectedProject.path)}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPages(data); else setPages([]); })
      .catch(() => setPages([]));
  }, [selectedProject]);

  // Fetch CLAUDE.md when project changes
  useEffect(() => {
    if (!selectedProject) { setClaudeMd(null); return; }
    setClaudeMdLoading(true);
    setClaudeMdEditing(false);
    fetch(`/api/files/read?path=${encodeURIComponent(selectedProject.path + '/CLAUDE.md')}`)
      .then(r => r.json())
      .then(data => setClaudeMd(data.content || null))
      .catch(() => setClaudeMd(null))
      .finally(() => setClaudeMdLoading(false));
  }, [selectedProject]);

  // Fetch git status when project changes (for integrations badge)
  useEffect(() => {
    if (!selectedProject) { setGitData(null); return; }
    fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
      .then(r => r.json())
      .then(setGitData)
      .catch(() => setGitData(null));
  }, [selectedProject]);

  // Fetch git diff and history when tab is selected
  useEffect(() => {
    if (rightPanel !== 'git' || !selectedProject) return;
    fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
      .then(r => r.json())
      .then(setGitData)
      .catch(() => setGitData(null));
    fetch(`/api/git/history?path=${encodeURIComponent(selectedProject.path)}`)
      .then(r => r.json())
      .then(data => setGitHistory(data.commits || []))
      .catch(() => setGitHistory([]));
  }, [rightPanel, selectedProject]);

  // Check Supabase status when project changes
  useEffect(() => {
    if (!selectedProject) { setSupabaseConnected(false); return; }
    fetch(`/api/supabase/status?path=${encodeURIComponent(selectedProject.path)}`)
      .then(r => r.json())
      .then(data => {
        setSupabaseConnected(!!data.connected);
        if (data.url) setSupabaseUrl(data.url);
      })
      .catch(() => setSupabaseConnected(false));
  }, [selectedProject]);

  const saveClaudeMd = useCallback(async () => {
    if (!selectedProject) return;
    setClaudeMdSaving(true);
    try {
      await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedProject.path + '/CLAUDE.md', content: claudeMdDraft }),
      });
      setClaudeMd(claudeMdDraft);
      setClaudeMdEditing(false);
    } catch {} finally {
      setClaudeMdSaving(false);
    }
  }, [selectedProject, claudeMdDraft]);

  const createNewProject = useCallback(async () => {
    setNewProjectError('');
    try {
      const resp = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });
      const data = await resp.json();
      if (data.error) {
        setNewProjectError(data.error);
        return;
      }
      // Refresh project list and connect
      const projResp = await fetch('/api/projects');
      const projs = await projResp.json();
      setProjects(projs);
      const newProj = projs.find((p: Project) => p.path === data.path);
      if (newProj) connectToProject(newProj);
      setShowNewProject(false);
      setNewProjectName('');
    } catch (err) {
      setNewProjectError('Failed to create project');
    }
  }, [newProjectName, connectToProject]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const statusDot = {
    idle: '#555570',
    connecting: '#fbbf24',
    running: '#4ade80',
    exited: '#555570',
  }[status];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#09090b' }}>
      {/* LEFT: Chat / Terminal Panel */}
      <div style={{
        width: isEmbed ? '100%' : (chatOpen ? 480 : 0),
        minWidth: isEmbed ? '100%' : (chatOpen ? 480 : 0),
        display: 'flex',
        flexDirection: 'column',
        background: '#18181b',
        borderRight: (!isEmbed && chatOpen) ? '1px solid #2a2a3a' : 'none',
        overflow: 'hidden',
        transition: isEmbed ? 'none' : 'width 0.25s ease, min-width 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid #2a2a3a',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          {/* Logo + wordmark — hide in embed mode since Chrome shows its own header */}
          {!isEmbed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <img src="/logo.png" alt="Clawable" style={{ width: 28, height: 28 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e4e4ef', whiteSpace: 'nowrap' }}>Clawable</span>
            </div>
          )}

          {/* Project dropdown */}
          <div ref={projectPickerRef} style={{ position: 'relative', flex: 1 }}>
            <button
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                color: '#e4e4ef',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{selectedProject?.name || 'Select project'}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showProjectPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showProjectPicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                overflow: 'hidden',
                zIndex: 100,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                maxHeight: 360,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 280,
              }}>
                <input
                  type="text"
                  id="project-search"
                  name="project-search"
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  autoFocus
                  style={{
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #3f3f46',
                    color: '#e4e4ef',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                  {/* New Project button */}
                  <button
                    onClick={() => { setShowNewProject(true); setShowProjectPicker(false); }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'transparent', border: 'none', borderBottom: '1px solid #3f3f46',
                      color: '#e07a4b', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#3f3f46'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    New Project
                  </button>
                  {filteredProjects.map(p => (
                    <button
                      key={p.path}
                      onClick={() => connectToProject(p)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: selectedProject?.path === p.path ? 'rgba(224,122,75,0.1)' : 'transparent',
                        border: 'none',
                        color: selectedProject?.path === p.path ? '#e07a4b' : '#e4e4ef',
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={e => { if (selectedProject?.path !== p.path) e.currentTarget.style.background = '#3f3f46'; }}
                      onMouseLeave={e => { if (selectedProject?.path !== p.path) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                        <path d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43679 3 6.69114 3.10536 6.87868 3.29289L7.70711 4.12132C7.89464 4.30886 8.149 4.41421 8.41421 4.41421H13C13.5523 4.41421 14 4.86193 14 5.41421V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History button */}
          {selectedProject && (
            <button
              onClick={() => {
                setShowHistory(h => !h);
                if (!showHistory) {
                  setHistoryLoading(true);
                  fetch(`/api/git/history?path=${encodeURIComponent(selectedProject.path)}`)
                    .then(r => r.json())
                    .then(data => setHistoryCommits(data.commits || []))
                    .catch(() => setHistoryCommits([]))
                    .finally(() => setHistoryLoading(false));
                }
              }}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: showHistory ? 'rgba(224,122,75,0.15)' : 'transparent',
                border: 'none',
                color: showHistory ? '#e07a4b' : '#71717a',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!showHistory) e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={e => { if (!showHistory) e.currentTarget.style.color = '#71717a'; }}
              title="Version history"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Status indicator + error badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: statusDot,
              boxShadow: status === 'running' ? `0 0 6px ${statusDot}` : 'none',
            }} />
            {errorCount > 0 && (
              <div
                onClick={() => setErrorCount(0)}
                title={`${errorCount} error(s) detected — click to dismiss`}
                style={{
                  background: '#dc2626', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  borderRadius: 10, padding: '1px 5px',
                  cursor: 'pointer', lineHeight: '14px',
                  animation: 'pulse 2s infinite',
                }}
              >
                {errorCount > 9 ? '9+' : errorCount}
              </div>
            )}
          </div>

          {/* Close button — embed/side panel mode */}
          {isEmbed && (
            <button
              onClick={() => window.parent.postMessage({ type: 'clawable-close' }, '*')}
              style={{
                width: 30, height: 30, borderRadius: 6,
                background: 'transparent', border: 'none',
                color: '#71717a', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e4e4ef'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; }}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Terminal / Chat area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {!selectedProject && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, zIndex: 10, background: '#18181b',
            }}>
              <img src="/logo.png" alt="Clawable" style={{ width: 56, height: 56 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#e4e4ef' }}>Clawable</div>
              <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
                Think of something you want to build
              </div>
            </div>
          )}
          <div
            ref={terminalRef}
            style={{
              position: 'absolute', inset: 0,
              opacity: selectedProject ? 1 : 0,
            }}
          />

          {/* Version history overlay */}
          {showHistory && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: '#18181b', overflow: 'auto',
            }}>
              <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4ef', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#e07a4b" strokeWidth="1.3" />
                    <path d="M8 5v3.5l2.5 1.5" stroke="#e07a4b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Version History
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{
                    width: 24, height: 24, borderRadius: 4,
                    background: 'transparent', border: 'none',
                    color: '#71717a', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {historyLoading ? (
                <div style={{ padding: 16, color: '#555570', fontSize: 13 }}>Loading history...</div>
              ) : historyCommits.length === 0 ? (
                <div style={{ padding: 16, color: '#555570', fontSize: 13 }}>
                  No git history. Connect to GitHub in the Git tab first.
                </div>
              ) : (
                <div style={{ padding: '0 8px 16px' }}>
                  {historyCommits.map((commit, i) => (
                    <CommitRow
                      key={commit.hash}
                      commit={commit}
                      isCurrent={i === 0}
                      projectPath={selectedProject!.path}
                      restoring={gitRestoring === commit.hash}
                      onRestore={() => {
                        if (!selectedProject || gitRestoring) return;
                        setGitRestoring(commit.hash);
                        fetch('/api/git/restore', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectPath: selectedProject.path, hash: commit.hash }),
                        }).then(r => r.json()).then(data => {
                          if (data.ok) {
                            setPreviewingVersion(null);
                            fetch(`/api/git/history?path=${encodeURIComponent(selectedProject.path)}`)
                              .then(r => r.json()).then(d => setHistoryCommits(d.commits || [])).catch(() => {});
                          }
                        }).catch(() => {})
                          .finally(() => setGitRestoring(null));
                      }}
                      onView={() => {
                        if (!selectedProject) return;
                        fetch('/api/git/preview-version', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectPath: selectedProject.path, hash: commit.hash }),
                        }).then(r => r.json()).then(data => {
                          if (data.ok) {
                            setPreviewingVersion({ hash: commit.hash, short: commit.short, message: commit.message });
                            setRightPanel('preview');
                            // Refresh preview after files are swapped
                            setTimeout(() => setPreviewKey(k => k + 1), 500);
                          }
                        }).catch(() => {});
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar with restart */}
        {status === 'exited' && selectedProject && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a3a' }}>
            <button
              onClick={() => connectToProject(selectedProject)}
              style={{
                width: '100%', padding: '10px',
                background: '#e07a4b', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Restart Session
            </button>
          </div>
        )}

        {/* Git actions bar */}
        {selectedProject && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid #2a2a3a',
            display: 'flex', gap: 8, flexShrink: 0,
          }}>
            <button
              onClick={async () => {
                if (!selectedProject) return;
                const gitEnv = { projectPath: selectedProject.path };
                try {
                  await fetch('/api/git/commit-and-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProject.path, commitOnly: true }),
                  });
                  termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Committed.\x1b[0m');
                } catch {}
              }}
              style={{
                flex: 1, padding: '8px', borderRadius: 8,
                background: '#27272a', border: '1px solid #3f3f46',
                color: '#a1a1aa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#e07a4b'; e.currentTarget.style.color = '#e4e4ef'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa'; }}
              title="Save a snapshot locally"
            >
              Commit
            </button>
            <button
              onClick={async () => {
                if (!selectedProject) return;
                try {
                  await fetch('/api/git/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProject.path }),
                  });
                  termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Pushed to GitHub.\x1b[0m');
                } catch {}
              }}
              style={{
                flex: 1, padding: '8px', borderRadius: 8,
                background: '#27272a', border: '1px solid #3f3f46',
                color: '#a1a1aa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#e07a4b'; e.currentTarget.style.color = '#e4e4ef'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa'; }}
              title="Upload commits to GitHub"
            >
              Push
            </button>
            <button
              onClick={async () => {
                if (!selectedProject) return;
                try {
                  await fetch('/api/git/commit-and-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath: selectedProject.path }),
                  });
                  termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Committed & pushed to GitHub.\x1b[0m');
                } catch {}
              }}
              style={{
                flex: 1, padding: '8px', borderRadius: 8,
                background: '#e07a4b', border: 'none',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              title="Commit and push in one step"
            >
              Commit & Push
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Preview Panel — hidden in embed mode */}
      {!isEmbed && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Preview Toolbar */}
        <div style={{
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid #2a2a3a',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#18181b',
          flexShrink: 0,
        }}>
          {/* Claw logo — shown in toolbar when chat is collapsed */}
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Open chat"
            >
              <img src="/logo.png" alt="Clawable" style={{ width: 24, height: 24 }} />
            </button>
          )}

          {/* Toggle chat panel */}
          <button
            onClick={() => setChatOpen(o => !o)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: chatOpen ? '#27272a' : '#e07a4b',
              border: 'none',
              color: chatOpen ? '#a1a1aa' : '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            title={chatOpen ? 'Collapse chat' : 'Show chat'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 2v12" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>

          {/* Preview / Code toggle */}
          <div style={{
            display: 'flex',
            background: '#27272a',
            borderRadius: 8,
            padding: 2,
            gap: 2,
          }}>
            <button
              onClick={() => setRightPanel('preview')}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: rightPanel === 'preview' ? '#e07a4b' : 'transparent',
                color: rightPanel === 'preview' ? '#fff' : '#71717a',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              Preview
            </button>
            <button
              onClick={() => setRightPanel('code')}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: rightPanel === 'code' ? '#e07a4b' : 'transparent',
                color: rightPanel === 'code' ? '#fff' : '#71717a',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              Code
            </button>
            <button
              onClick={() => setRightPanel('claude')}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: rightPanel === 'claude' ? '#e07a4b' : 'transparent',
                color: rightPanel === 'claude' ? '#fff' : '#71717a',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              CLAUDE.md
            </button>
            {/* Integrations dropdown */}
            <div ref={integrationsRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowIntegrations(v => !v); if (showIntegrations) setIntegrationSettings(null); }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: showIntegrations ? '#e07a4b' : 'transparent',
                  color: showIntegrations ? '#fff' : '#71717a',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                Integrations
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: showIntegrations ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showIntegrations && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0,
                  marginTop: 6, background: '#1c1c20', border: '1px solid #2a2a3a',
                  borderRadius: 12, zIndex: 100,
                  boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                  overflow: 'visible',
                }}>
                  {/* Integration list */}
                  <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
                  <div style={{ padding: '16px 20px 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4ef' }}>Add integrations</div>
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>Connect the tools you use to your project.</div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
                    {/* GitHub */}
                    <button
                      onClick={() => setIntegrationSettings(integrationSettings === 'github' ? null : 'github')}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 10,
                        background: integrationSettings === 'github' ? '#222228' : 'transparent', border: 'none',
                        color: '#e4e4ef', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (integrationSettings !== 'github') e.currentTarget.style.background = '#222228'; }}
                      onMouseLeave={e => { if (integrationSettings !== 'github') e.currentTarget.style.background = 'transparent'; }}
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
                        <div style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                          background: '#e4e4ef', color: '#18181b',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8.5l3.5 3.5L13 4" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Connected
                        </div>
                      ) : (
                        <div style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                          background: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46',
                        }}>
                          Connect
                        </div>
                      )}
                    </button>

                    <div style={{ height: 1, background: '#2a2a3a', margin: '0 12px' }} />

                    {/* Supabase */}
                    <button
                      onClick={() => setIntegrationSettings(integrationSettings === 'supabase' ? null : 'supabase')}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 10,
                        background: integrationSettings === 'supabase' ? '#222228' : 'transparent', border: 'none',
                        color: '#e4e4ef', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (integrationSettings !== 'supabase') e.currentTarget.style.background = '#222228'; }}
                      onMouseLeave={e => { if (integrationSettings !== 'supabase') e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid #2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                        <div style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                          background: '#e4e4ef', color: '#18181b',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8.5l3.5 3.5L13 4" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Connected
                        </div>
                      ) : (
                        <div style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                          background: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46',
                        }}>
                          Connect
                        </div>
                      )}
                    </button>

                    <div style={{ height: 1, background: '#2a2a3a', margin: '0 12px' }} />

                    {/* Vercel — coming soon */}
                    <div style={{
                      width: '100%', padding: '12px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: 0.45,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid #2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="#e4e4ef">
                          <path d="M8 1L15.794 14.5H0.206L8 1Z" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', display: 'flex', alignItems: 'center', gap: 6 }}>
                          Vercel
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e07a4b', background: 'rgba(224,122,75,0.15)', padding: '1px 5px', borderRadius: 4, lineHeight: '14px' }}>SOON</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Deploy and host your frontend.</div>
                      </div>
                      <div style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                        background: 'transparent', color: '#555570', border: '1px solid #2a2a3a',
                      }}>
                        Connect
                      </div>
                    </div>

                    <div style={{ height: 1, background: '#2a2a3a', margin: '0 12px' }} />

                    {/* Netlify — coming soon */}
                    <div style={{
                      width: '100%', padding: '12px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: 0.45,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1c1c1c', border: '1px solid #2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                          <path d="M8 1l7 13H1L8 1z" stroke="#3fb5a3" strokeWidth="1.2" fill="none" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', display: 'flex', alignItems: 'center', gap: 6 }}>
                          Netlify
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e07a4b', background: 'rgba(224,122,75,0.15)', padding: '1px 5px', borderRadius: 4, lineHeight: '14px' }}>SOON</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>Deploy and host with Netlify.</div>
                      </div>
                      <div style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                        background: 'transparent', color: '#555570', border: '1px solid #2a2a3a',
                      }}>
                        Connect
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Settings side panel (pops out to the right) */}
                  {integrationSettings && (
                    <div style={{
                      position: 'absolute', top: 0, left: '100%',
                      width: 360, marginLeft: 6,
                      background: '#1c1c20', border: '1px solid #2a2a3a',
                      borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                      display: 'flex', flexDirection: 'column', maxHeight: 420,
                    }}>
                      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #2a2a3a' }}>
                        {integrationSettings === 'github' && (
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="#000">
                              <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                          </div>
                        )}
                        {integrationSettings === 'supabase' && (
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1c1c1c', border: '1px solid #2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 109 113" fill="none">
                              <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="#3ECF8E" />
                              <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
                            </svg>
                          </div>
                        )}
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#e4e4ef' }}>Integration settings</div>
                        <button
                          onClick={() => setIntegrationSettings(null)}
                          style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#e4e4ef'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </button>
                      </div>

                      {integrationSettings === 'supabase' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', marginBottom: 4 }}>Supabase</div>
                          <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, marginBottom: 6 }}>
                            Supabase gives your app a database, user login, and file storage.
                          </div>

                          {/* Step-by-step instructions */}
                          <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', background: '#222226', borderRadius: 8, border: '1px solid #2a2a3a' }}>
                            <div style={{ fontWeight: 600, color: '#a1a1aa', marginBottom: 4 }}>Where to find these:</div>
                            1. Go to <span style={{ color: '#3ECF8E' }}>supabase.com</span> and sign in<br />
                            2. Open your project (or create one)<br />
                            3. Go to <span style={{ color: '#e4e4ef' }}>Settings → API</span><br />
                            4. Copy the <span style={{ color: '#e4e4ef' }}>Project URL</span> and <span style={{ color: '#e4e4ef' }}>anon public</span> key below
                          </div>

                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>Project URL</label>
                              {supabaseConnected && supabaseUrl && (
                                <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                  Connected
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#555570', marginBottom: 4 }}>The URL of your Supabase project (starts with https://)</div>
                            <input
                              type="text" placeholder="https://xxxxx.supabase.co"
                              value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid #2a2a3a', borderRadius: 8, color: '#e4e4ef', fontSize: 13, outline: 'none', fontFamily: "'SF Mono', Menlo, monospace", boxSizing: 'border-box' }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#3f3f46'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = '#2a2a3a'; }}
                            />
                          </div>

                          <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Anon Key</label>
                            <div style={{ fontSize: 10, color: '#555570', marginBottom: 4 }}>The public key — safe to use in your app's frontend code</div>
                            <input
                              type="password" placeholder="eyJhbG..."
                              value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid #2a2a3a', borderRadius: 8, color: '#e4e4ef', fontSize: 13, outline: 'none', fontFamily: "'SF Mono', Menlo, monospace", boxSizing: 'border-box' }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#3f3f46'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = '#2a2a3a'; }}
                            />
                          </div>

                          {/* Service Role Key — advanced */}
                          <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                              Service Role Key <span style={{ fontWeight: 400, color: '#555570' }}>(optional)</span>
                            </label>
                            <div style={{ fontSize: 10, color: '#555570', marginBottom: 4 }}>
                              Only needed if your app has a backend/server. This key has full database access — keep it secret.
                              Found in the same Settings → API page, under "service_role".
                            </div>
                            <input
                              type="password" placeholder="eyJhbG... (leave blank if unsure)"
                              value={supabaseServiceKey || ''} onChange={e => setSupabaseServiceKey(e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', background: '#222226', border: '1px solid #2a2a3a', borderRadius: 8, color: '#e4e4ef', fontSize: 13, outline: 'none', fontFamily: "'SF Mono', Menlo, monospace", boxSizing: 'border-box' }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#3f3f46'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = '#2a2a3a'; }}
                            />
                          </div>

                          <button
                            onClick={() => {
                              if (!supabaseUrl || !supabaseAnonKey || !selectedProject) return;
                              setSupabaseConnecting(true); setSupabaseConnectMsg('');
                              fetch('/api/supabase/connect', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ projectPath: selectedProject.path, supabaseUrl, supabaseAnonKey, supabaseServiceKey }),
                              })
                                .then(r => r.json())
                                .then(data => { if (data.error) setSupabaseConnectMsg(data.error); else { setSupabaseConnectMsg(data.message || 'Connected!'); setSupabaseConnected(true); } })
                                .catch(() => setSupabaseConnectMsg('Connection failed'))
                                .finally(() => setSupabaseConnecting(false));
                            }}
                            disabled={!supabaseUrl || !supabaseAnonKey || supabaseConnecting}
                            style={{
                              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                              background: (supabaseUrl && supabaseAnonKey) ? '#3ECF8E' : '#3f3f46',
                              color: (supabaseUrl && supabaseAnonKey) ? '#000' : '#71717a',
                              fontSize: 13, fontWeight: 600,
                              cursor: (supabaseUrl && supabaseAnonKey && !supabaseConnecting) ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {supabaseConnecting ? 'Connecting...' : supabaseConnected ? 'Update' : 'Connect'}
                          </button>

                          {supabaseConnectMsg && (
                            <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginTop: 10, color: supabaseConnectMsg.toLowerCase().includes('fail') || supabaseConnectMsg.toLowerCase().includes('error') ? '#f87171' : '#4ade80' }}>
                              {supabaseConnectMsg}
                            </div>
                          )}
                        </div>
                      )}

                      {integrationSettings === 'github' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', marginBottom: 4 }}>GitHub</div>
                          <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, marginBottom: 6 }}>
                            GitHub saves your project's code online so you never lose it and can share it with others.
                          </div>

                          {gitData?.remote ? (
                            <>
                              <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>Repository</label>
                                <div style={{
                                  padding: '10px 12px', background: '#27272a', borderRadius: 8,
                                  border: '1px solid #3f3f46',
                                  fontSize: 12, color: '#e4e4ef',
                                  fontFamily: "'SF Mono', Menlo, monospace",
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
                                  background: '#e4e4ef', color: '#18181b',
                                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                Open Git Panel
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Step-by-step instructions */}
                              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', background: '#222226', borderRadius: 8, border: '1px solid #2a2a3a' }}>
                                <div style={{ fontWeight: 600, color: '#a1a1aa', marginBottom: 4 }}>How to get a repository URL:</div>
                                1. Go to <span style={{ color: '#e4e4ef' }}>github.com</span> and sign in<br />
                                2. Click the <span style={{ color: '#e4e4ef' }}>+</span> button (top right) → <span style={{ color: '#e4e4ef' }}>New repository</span><br />
                                3. Give it a name and click <span style={{ color: '#e4e4ef' }}>Create repository</span><br />
                                4. Copy the URL from the page (ends in .git)
                              </div>

                              <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Repository URL</label>
                                <div style={{ fontSize: 10, color: '#555570', marginBottom: 4 }}>Paste the URL of your GitHub repository here</div>
                                <input
                                  type="text"
                                  id="github-repo-url"
                                  name="github-repo-url"
                                  placeholder="https://github.com/you/repo.git"
                                  value={gitRepoUrl}
                                  onChange={e => setGitRepoUrl(e.target.value)}
                                  style={{
                                    width: '100%', padding: '10px 12px', background: '#27272a',
                                    border: '1px solid #3f3f46', borderRadius: 8,
                                    color: '#e4e4ef', fontSize: 12, outline: 'none',
                                    fontFamily: "'SF Mono', Menlo, monospace",
                                  }}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  if (!gitRepoUrl || !selectedProject || gitConnecting) return;
                                  setGitConnecting(true); setGitConnectMsg('');
                                  fetch('/api/git/connect', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ projectPath: selectedProject.path, repoUrl: gitRepoUrl }),
                                  }).then(r => r.json()).then(data => {
                                    if (data.error) setGitConnectMsg(data.error);
                                    else { setGitConnectMsg(data.message || 'Connected!'); setGitRepoUrl(''); }
                                    fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                                      .then(r => r.json()).then(setGitData).catch(() => {});
                                  }).catch(() => setGitConnectMsg('Connection failed'))
                                    .finally(() => setGitConnecting(false));
                                }}
                                disabled={!gitRepoUrl || gitConnecting}
                                style={{
                                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                                  background: gitRepoUrl ? '#e4e4ef' : '#3f3f46',
                                  color: gitRepoUrl ? '#18181b' : '#71717a',
                                  fontSize: 13, fontWeight: 600,
                                  cursor: gitRepoUrl && !gitConnecting ? 'pointer' : 'not-allowed',
                                }}
                              >
                                {gitConnecting ? 'Connecting...' : 'Connect'}
                              </button>
                              {gitConnectMsg && (
                                <div style={{
                                  fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginTop: 10,
                                  color: gitConnectMsg.toLowerCase().includes('fail') || gitConnectMsg.toLowerCase().includes('error') ? '#f87171' : '#4ade80',
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
              )}
            </div>
          </div>

          {/* Page navigation bar */}
          <div ref={pageDropdownRef} style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: '#27272a', borderRadius: 8,
            padding: '0 12px', height: 34, gap: 8,
            position: 'relative',
          }}>
            {previewRunning ? (
              <>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', flexShrink: 0 }} />
                <button
                  onClick={() => setShowPageDropdown(v => !v)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                    color: '#a1a1aa', fontSize: 13, fontFamily: "'SF Mono', Menlo, monospace",
                    flex: 1, minWidth: 0,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedProject?.name}{currentPage !== '/' ? currentPage : ''}
                  </span>
                  {pages.length > 0 && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: showPageDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {showPageDropdown && pages.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    marginTop: 4, background: '#27272a', border: '1px solid #3f3f46',
                    borderRadius: 8, overflow: 'hidden', zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    maxHeight: 320, overflowY: 'auto',
                  }}>
                    {pages.map(p => (
                      <button
                        key={p.path}
                        onClick={() => {
                          setCurrentPage(p.path);
                          setShowPageDropdown(false);
                          setPreviewKey(k => k + 1);
                        }}
                        style={{
                          width: '100%', padding: '8px 14px',
                          background: currentPage === p.path ? 'rgba(224,122,75,0.1)' : 'transparent',
                          border: 'none',
                          color: currentPage === p.path ? '#e07a4b' : '#e4e4ef',
                          fontSize: 12, cursor: 'pointer', textAlign: 'left',
                          fontFamily: "'SF Mono', Menlo, monospace",
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                        onMouseEnter={e => { if (currentPage !== p.path) e.currentTarget.style.background = '#3f3f46'; }}
                        onMouseLeave={e => { if (currentPage !== p.path) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                          <path d="M3 2h7l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span style={{ fontSize: 13, color: '#555570' }}>
                {selectedProject ? 'Ready to preview' : 'Select a project'}
              </span>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => setPreviewKey(k => k + 1)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: '#27272a', border: 'none',
              color: '#71717a', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Refresh preview"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.8M13.5 2v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Open in new tab */}
          <button
            onClick={() => { if (previewRunning && previewUrl) window.open(previewUrl + (currentPage === '/' ? '' : currentPage), '_blank'); }}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: '#27272a', border: 'none',
              color: '#71717a', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Open in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Help / Docs dropdown */}
          <div ref={docsMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDocsMenu(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: showDocsMenu ? '#e07a4b' : '#27272a', border: 'none',
                color: showDocsMenu ? '#fff' : '#71717a', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              title="Help & Docs"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M1 3c1.5-1 3.5-1 5 0v10c-1.5-1-3.5-1-5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 3c-1.5-1-3.5-1-5 0v10c1.5-1 3.5-1 5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 3v10" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
            {showDocsMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0,
                marginTop: 6, background: '#1c1c20', border: '1px solid #2a2a3a',
                borderRadius: 10, zIndex: 100,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                minWidth: 220, padding: '6px',
              }}>
                <button
                  onClick={() => { window.open('/docs', '_blank'); setShowDocsMenu(false); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'transparent', border: 'none',
                    color: '#e4e4ef', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#222228'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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

                <div style={{ height: 1, background: '#2a2a3a', margin: '2px 8px' }} />

                <button
                  onClick={() => { window.open('/docs#section-8', '_blank'); setShowDocsMenu(false); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'transparent', border: 'none',
                    color: '#e4e4ef', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#222228'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 6.5a2 2 0 0 1 3.5 1.5c0 1-1.5 1.5-1.5 1.5M8 12h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  FAQ
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                    <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div style={{ height: 1, background: '#2a2a3a', margin: '2px 8px' }} />

                <button
                  onClick={() => { window.open('https://github.com/AlexandreFlamant/clawable', '_blank'); setShowDocsMenu(false); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'transparent', border: 'none',
                    color: '#e4e4ef', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#222228'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  GitHub
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                    <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Version preview banner */}
        {previewingVersion && (
          <div style={{
            padding: '8px 16px', background: '#1e3a5f',
            borderBottom: '1px solid #2563eb',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#60a5fa" strokeWidth="1.3" />
              <path d="M8 5v3.5l2.5 1.5" stroke="#60a5fa" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 12, color: '#93bbfd', flex: 1 }}>
              Viewing <strong style={{ color: '#fff' }}>{previewingVersion.short}</strong> — {previewingVersion.message}
            </span>
            <button
              onClick={() => {
                if (!selectedProject) return;
                fetch('/api/git/preview-restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectPath: selectedProject.path }),
                }).then(() => {
                  setPreviewingVersion(null);
                  setTimeout(() => setPreviewKey(k => k + 1), 500);
                }).catch(() => {});
              }}
              style={{
                padding: '4px 12px', borderRadius: 5, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to current
            </button>
          </div>
        )}

        {/* Content area — Preview, Code, or CLAUDE.md */}
        <div style={{ flex: 1, background: '#09090b', position: 'relative' }}>
          {rightPanel === 'claude' && selectedProject ? (
            <div style={{
              position: 'absolute', inset: 0, overflow: 'auto', background: '#18181b',
              padding: '24px 48px',
              display: 'flex', flexDirection: 'column',
            }}>
              {claudeMdLoading ? (
                <div style={{ color: '#555570', fontSize: 13 }}>Loading...</div>
              ) : claudeMdEditing ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
                    <button
                      onClick={saveClaudeMd}
                      disabled={claudeMdSaving}
                      style={{
                        padding: '6px 16px', borderRadius: 6, border: 'none',
                        background: '#e07a4b', color: '#fff', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {claudeMdSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setClaudeMdEditing(false)}
                      style={{
                        padding: '6px 16px', borderRadius: 6, border: '1px solid #3f3f46',
                        background: 'transparent', color: '#a1a1aa', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    value={claudeMdDraft}
                    onChange={e => setClaudeMdDraft(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1, background: '#27272a', border: '1px solid #3f3f46',
                      borderRadius: 8, padding: 16, color: '#e4e4ef',
                      fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
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
                      style={{
                        padding: '6px 16px', borderRadius: 6, border: '1px solid #3f3f46',
                        background: 'transparent', color: '#a1a1aa', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
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
                    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
                    fontSize: 13, lineHeight: '22px', color: '#e4e4ef',
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
                  <div style={{ fontSize: 14, color: '#555570' }}>
                    No CLAUDE.md found in this project
                  </div>
                  <div style={{ fontSize: 12, color: '#3f3f46', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
                    CLAUDE.md is a file at the root of your project that guides Claude Code — architecture, conventions, and key context.
                  </div>
                  <button
                    onClick={() => {
                      setClaudeMdDraft(`# ${selectedProject.name}\n\nDescribe your project here.\n`);
                      setClaudeMdEditing(true);
                    }}
                    style={{
                      marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none',
                      background: '#e07a4b', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Create CLAUDE.md
                  </button>
                </div>
              )}
            </div>
          ) : rightPanel === 'git' && selectedProject ? (
            <div style={{
              position: 'absolute', inset: 0, overflow: 'auto', background: '#18181b',
              padding: '24px 32px',
            }}>
              {!gitData ? (
                <div style={{ color: '#555570', fontSize: 13 }}>Loading...</div>
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e4e4ef' }}>
                    Connect to GitHub
                  </div>
                  <div style={{ fontSize: 12, color: '#555570', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
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
                        if (e.key === 'Enter' && gitRepoUrl && selectedProject) {
                          setGitConnecting(true); setGitConnectMsg('');
                          fetch('/api/git/connect', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectPath: selectedProject.path, repoUrl: gitRepoUrl }),
                          }).then(r => r.json()).then(data => {
                            if (data.error) setGitConnectMsg(data.error);
                            else { setGitConnectMsg(data.message || 'Connected!'); setGitRepoUrl(''); }
                            // Refresh git data
                            fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                              .then(r => r.json()).then(setGitData).catch(() => {});
                          }).catch(() => setGitConnectMsg('Connection failed'))
                            .finally(() => setGitConnecting(false));
                        }
                      }}
                      style={{
                        flex: 1, padding: '10px 14px', background: '#27272a',
                        border: '1px solid #3f3f46', borderRadius: 8,
                        color: '#e4e4ef', fontSize: 13, outline: 'none',
                        fontFamily: "'SF Mono', Menlo, monospace",
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!gitRepoUrl || !selectedProject) return;
                        setGitConnecting(true); setGitConnectMsg('');
                        fetch('/api/git/connect', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectPath: selectedProject.path, repoUrl: gitRepoUrl }),
                        }).then(r => r.json()).then(data => {
                          if (data.error) setGitConnectMsg(data.error);
                          else { setGitConnectMsg(data.message || 'Connected!'); setGitRepoUrl(''); }
                          fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                            .then(r => r.json()).then(setGitData).catch(() => {});
                        }).catch(() => setGitConnectMsg('Connection failed'))
                          .finally(() => setGitConnecting(false));
                      }}
                      disabled={!gitRepoUrl || gitConnecting}
                      style={{
                        padding: '10px 20px', borderRadius: 8, border: 'none',
                        background: gitRepoUrl ? '#e07a4b' : '#3f3f46',
                        color: '#fff', fontSize: 13, fontWeight: 600,
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
                      color: gitConnectMsg.includes('fail') || gitConnectMsg.includes('error') ? '#f87171' : '#4ade80',
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
                          if (!selectedProject) return;
                          setGitPushing(true); setGitPushMsg('');
                          fetch('/api/git/commit-and-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectPath: selectedProject.path }),
                          }).then(r => r.json()).then(data => {
                            setGitPushMsg(data.error || 'Committed and pushed!');
                            fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                              .then(r => r.json()).then(setGitData).catch(() => {});
                          }).catch(() => setGitPushMsg('Push failed'))
                            .finally(() => setGitPushing(false));
                        }}
                        disabled={gitPushing}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: '#e07a4b', color: '#fff',
                          fontSize: 12, fontWeight: 600, cursor: gitPushing ? 'wait' : 'pointer',
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
                        if (!selectedProject) return;
                        setGitPushing(true); setGitPushMsg('');
                        fetch('/api/git/push', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectPath: selectedProject.path }),
                        }).then(r => r.json()).then(data => {
                          setGitPushMsg(data.error || 'Pushed!');
                          fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                            .then(r => r.json()).then(setGitData).catch(() => {});
                        }).catch(() => setGitPushMsg('Push failed'))
                          .finally(() => setGitPushing(false));
                      }}
                      disabled={gitPushing}
                      style={{
                        padding: '8px 16px', borderRadius: 8,
                        border: '1px solid #3f3f46', background: 'transparent',
                        color: '#a1a1aa', fontSize: 12, fontWeight: 500,
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
                        if (!selectedProject) return;
                        fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                          .then(r => r.json()).then(setGitData).catch(() => {});
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid #3f3f46', background: 'transparent',
                        color: '#71717a', cursor: 'pointer',
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
                        color: gitPushMsg.includes('fail') || gitPushMsg.includes('error') || gitPushMsg.includes('Error') ? '#f87171' : '#4ade80',
                      }}>
                        {gitPushMsg}
                      </span>
                    )}
                  </div>

                  {/* Remote info */}
                  {gitData.remote && (
                    <div style={{ fontSize: 11, color: '#555570', marginBottom: 16, fontFamily: "'SF Mono', Menlo, monospace" }}>
                      {gitData.remote}
                    </div>
                  )}

                  {/* Changed files */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', marginBottom: 8 }}>
                      Changed Files {gitData.files.length > 0 && <span style={{ color: '#e07a4b' }}>({gitData.files.length})</span>}
                    </div>
                    {gitData.files.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#555570' }}>No changes</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {gitData.files.map(f => (
                          <div key={f.file} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 8px', borderRadius: 4,
                            fontSize: 13, fontFamily: "'SF Mono', Menlo, monospace",
                          }}>
                            <span style={{
                              width: 18, textAlign: 'center', fontSize: 11, fontWeight: 700,
                              color: f.status === 'M' ? '#fbbf24' : f.status === 'A' || f.status === '?' ? '#4ade80' : f.status === 'D' ? '#f87171' : '#a1a1aa',
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', marginBottom: 8 }}>Diff</div>
                      <pre style={{
                        margin: 0, padding: 16, background: '#0f0f13', borderRadius: 8,
                        border: '1px solid #2a2a3a', overflow: 'auto',
                        fontFamily: "'SF Mono', Menlo, monospace", fontSize: 12,
                        lineHeight: '18px', whiteSpace: 'pre',
                      }}>
                        {(gitData.diffStaged + '\n' + gitData.diff).split('\n').map((line, i) => (
                          <div key={i} style={{
                            color: line.startsWith('+') && !line.startsWith('+++') ? '#4ade80' :
                                   line.startsWith('-') && !line.startsWith('---') ? '#f87171' :
                                   line.startsWith('@@') ? '#60a5fa' :
                                   line.startsWith('diff') ? '#e07a4b' : '#71717a',
                          }}>
                            {line}
                          </div>
                        ))}
                      </pre>
                    </div>
                  )}

                  {/* Commit history */}
                  {gitHistory.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ef', marginBottom: 12 }}>History</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {gitHistory.map((commit, i) => (
                          <CommitRow
                            key={commit.hash}
                            commit={commit}
                            isCurrent={i === 0}
                            projectPath={selectedProject!.path}
                            restoring={gitRestoring === commit.hash}
                            onRestore={() => {
                              if (!selectedProject || gitRestoring) return;
                              setGitRestoring(commit.hash);
                              fetch('/api/git/restore', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ projectPath: selectedProject.path, hash: commit.hash }),
                              }).then(r => r.json()).then(data => {
                                if (data.error) { setGitPushMsg(data.error); }
                                else { setGitPushMsg('Restored!'); }
                                fetch(`/api/git/diff?path=${encodeURIComponent(selectedProject.path)}`)
                                  .then(r => r.json()).then(setGitData).catch(() => {});
                                fetch(`/api/git/history?path=${encodeURIComponent(selectedProject.path)}`)
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
          ) : rightPanel === 'code' && selectedProject ? (
            <CodeViewer projectPath={selectedProject.path} />
          ) : previewUrl ? (
            <iframe
              key={previewKey}
              src={previewUrl + (currentPage === '/' ? '' : currentPage)}
              style={{
                width: '100%', height: '100%',
                border: 'none', background: '#fff',
              }}
              title="Preview"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 16,
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.15 }}>
                <rect x="4" y="8" width="40" height="28" rx="4" stroke="white" strokeWidth="2" />
                <path d="M4 16h40" stroke="white" strokeWidth="2" />
                <circle cx="10" cy="12" r="1.5" fill="white" />
                <circle cx="15" cy="12" r="1.5" fill="white" />
                <circle cx="20" cy="12" r="1.5" fill="white" />
                <path d="M16 40h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 36v4" stroke="white" strokeWidth="2" />
              </svg>
              {selectedProject ? (
                <>
                  <button
                    onClick={launchPreview}
                    disabled={previewLoading}
                    style={{
                      padding: '12px 28px', borderRadius: 10, border: 'none',
                      background: '#e07a4b', color: '#fff',
                      fontSize: 14, fontWeight: 600, cursor: previewLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'transform 0.1s, box-shadow 0.15s',
                      boxShadow: '0 0 20px rgba(224, 122, 75, 0.2)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(224, 122, 75, 0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(224, 122, 75, 0.2)'; }}
                  >
                    {previewLoading ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M8 2a6 6 0 1 0 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 2l10 6-10 6V2z" fill="currentColor" />
                      </svg>
                    )}
                    {previewLoading ? 'Starting server...' : 'Run Preview'}
                  </button>
                  <div style={{ fontSize: 12, color: '#3f3f46' }}>
                    Launches the dev server and loads the preview
                  </div>
                  {previewError && (
                    <div style={{ fontSize: 12, color: '#f87171', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
                      {previewError}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: '#3f3f46' }}>
                    Select a project to get started
                  </div>
                  <div style={{ fontSize: 12, color: '#27272a' }}>
                    Click "Run Preview" after selecting a project
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>}

      {/* New Project Modal */}
      {showNewProject && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }} onClick={() => setShowNewProject(false)}>
          <div style={{
            background: '#27272a', borderRadius: 12, padding: 24,
            width: 400, border: '1px solid #3f3f46',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e4e4ef', marginBottom: 16 }}>
              New Project
            </div>
            <input
              type="text"
              id="new-project-name"
              name="new-project-name"
              placeholder="my-awesome-app"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newProjectName) createNewProject(); }}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', background: '#18181b',
                border: '1px solid #3f3f46', borderRadius: 8,
                color: '#e4e4ef', fontSize: 14, outline: 'none',
                fontFamily: "'SF Mono', Menlo, monospace",
              }}
            />
            <div style={{ fontSize: 11, color: '#555570', marginTop: 6 }}>
              Creates ~/Developer/{newProjectName || '...'}
            </div>
            {newProjectError && (
              <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{newProjectError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewProject(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #3f3f46',
                  background: 'transparent', color: '#a1a1aa', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={createNewProject}
                disabled={!newProjectName}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: newProjectName ? '#e07a4b' : '#3f3f46',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: newProjectName ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
