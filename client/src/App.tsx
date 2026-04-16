import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import CodeViewer from './CodeViewer';
import CommitRow from './components/CommitRow';
import SetupScreen from './components/SetupScreen';
import NewProjectModal from './components/NewProjectModal';
import MainMenu from './components/MainMenu';
import IntegrationsDropdown from './components/IntegrationsDropdown';
import GitPanel from './components/GitPanel';
import ClaudeMdPanel from './components/ClaudeMdPanel';
import DocsMenu from './components/DocsMenu';

interface Project {
  name: string;
  path: string;
}

const isEmbed = new URLSearchParams(window.location.search).has('embed');

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
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [projectsDir, setProjectsDir] = useState('~/Developer');
  const [setupDir, setSetupDir] = useState('~/Developer');
  const [setupError, setSetupError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
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
  const [showGitActions, setShowGitActions] = useState(false);
  const [gitAction, setGitAction] = useState<'commit-push' | 'commit' | 'push'>('commit-push');
  const [gitPushing, setGitPushing] = useState(false);
  const [gitPushMsg, setGitPushMsg] = useState('');
  const [gitHistory, setGitHistory] = useState<{ hash: string; short: string; message: string; author: string; date: string }[]>([]);
  const [gitRestoring, setGitRestoring] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCommits, setHistoryCommits] = useState<{ hash: string; short: string; message: string; author: string; date: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState<{ hash: string; short: string; message: string } | null>(null);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [mainMenuTab, setMainMenuTab] = useState<'projects' | 'settings'>('projects');
  const [settingsDir, setSettingsDir] = useState('');
  const [settingsDirSaving, setSettingsDirSaving] = useState(false);
  const [settingsDirMsg, setSettingsDirMsg] = useState('');

  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
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
      if (showMainMenu && mainMenuRef.current && !mainMenuRef.current.contains(e.target as Node)) {
        setShowMainMenu(false);
      }
      if (showIntegrations && integrationsRef.current && !integrationsRef.current.contains(e.target as Node)) {
        setShowIntegrations(false);
      }
      if (showDocsMenu && docsMenuRef.current && !docsMenuRef.current.contains(e.target as Node)) {
        setShowDocsMenu(false);
      }
    };
    const blurHandler = () => {
      if (showPageDropdown) setShowPageDropdown(false);
      if (showProjectPicker) setShowProjectPicker(false);
      if (showMainMenu) setShowMainMenu(false);
      if (showIntegrations) setShowIntegrations(false);
      if (showDocsMenu) setShowDocsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('blur', blurHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('blur', blurHandler);
    };
  }, [showPageDropdown, showProjectPicker, showMainMenu, showIntegrations, showDocsMenu]);

  // Fetch settings (first-launch detection)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setConfigured(data.configured);
        if (data.projectsDirDisplay) {
          setProjectsDir(data.projectsDirDisplay);
          setSetupDir(data.projectsDirDisplay);
        }
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  // Fetch projects (only after setup is complete)
  useEffect(() => {
    if (!settingsLoaded || !configured) return;
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {});
  }, [settingsLoaded, configured]);

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
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        setPreviewKey(k => k + 1);
        fetch(`/api/pages?path=${encodeURIComponent(selectedProject.path)}`)
          .then(r => r.json())
          .then(data => { if (Array.isArray(data)) setPages(data); })
          .catch(() => {});
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
        fetch(`/api/pages?path=${encodeURIComponent(selectedProject.path)}`)
          .then(r => r.json())
          .then(d => { if (Array.isArray(d)) setPages(d); })
          .catch(() => {});
      }
    } catch (err) {
      setPreviewError(`Failed to start preview: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPreviewLoading(false);
    }
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

  // Fetch git status when project changes
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

  const saveSetup = useCallback(async () => {
    setSetupError('');
    setSetupSaving(true);
    try {
      const resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectsDir: setupDir }),
      });
      const data = await resp.json();
      if (data.error) {
        setSetupError(data.error);
        return;
      }
      setProjectsDir(data.projectsDirDisplay);
      setConfigured(true);
    } catch {
      setSetupError('Failed to save settings');
    } finally {
      setSetupSaving(false);
    }
  }, [setupDir]);

  const saveSettingsDir = useCallback(async () => {
    setSettingsDirSaving(true);
    setSettingsDirMsg('');
    try {
      const resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectsDir: settingsDir }),
      });
      const data = await resp.json();
      if (data.error) {
        setSettingsDirMsg(data.error);
        return;
      }
      setProjectsDir(data.projectsDirDisplay);
      setSettingsDirMsg('Saved');
      const projResp = await fetch('/api/projects');
      const projs = await projResp.json();
      setProjects(projs);
      setTimeout(() => setSettingsDirMsg(''), 2000);
    } catch {
      setSettingsDirMsg('Failed to save');
    } finally {
      setSettingsDirSaving(false);
    }
  }, [settingsDir]);

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

  // First-launch setup screen
  if (settingsLoaded && !configured) {
    return (
      <SetupScreen
        setupDir={setupDir}
        setSetupDir={setSetupDir}
        saveSetup={saveSetup}
        setupSaving={setupSaving}
        setupError={setupError}
      />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-deepest)' }}>
      {/* LEFT: Chat / Terminal Panel */}
      <div style={{
        width: isEmbed ? '100%' : (chatOpen ? 480 : 0),
        minWidth: isEmbed ? '100%' : (chatOpen ? 480 : 0),
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: (!isEmbed && chatOpen) ? '1px solid var(--border-subtle)' : 'none',
        overflow: 'hidden',
        transition: isEmbed ? 'none' : 'width 0.25s ease, min-width 0.25s ease',
      }}>
        {/* Header */}
        <div className="toolbar">
          {/* Menu button + dropdown */}
          <div ref={mainMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="btn-ghost"
              onClick={() => { setShowMainMenu(!showMainMenu); if (!showMainMenu) { setSettingsDir(projectsDir); setSettingsDirMsg(''); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                background: showMainMenu ? 'var(--accent-bg)' : 'transparent',
                borderRadius: 6, color: showMainMenu ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {!isEmbed && <img src="/logo.png" alt="Hemingweight" style={{ width: 24, height: 24 }} />}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <MainMenu
              show={showMainMenu}
              mainMenuTab={mainMenuTab}
              setMainMenuTab={setMainMenuTab}
              projectSearch={projectSearch}
              setProjectSearch={setProjectSearch}
              filteredProjects={filteredProjects}
              selectedProject={selectedProject}
              connectToProject={connectToProject}
              onNewProject={() => setShowNewProject(true)}
              onClose={() => setShowMainMenu(false)}
              settingsDir={settingsDir}
              setSettingsDir={(v) => { setSettingsDir(v); setSettingsDirMsg(''); }}
              projectsDir={projectsDir}
              saveSettingsDir={saveSettingsDir}
              settingsDirSaving={settingsDirSaving}
              settingsDirMsg={settingsDirMsg}
            />
          </div>

          {/* Current project name */}
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedProject?.name || 'Select project'}
          </div>

          {/* History button */}
          {selectedProject && (
            <button
              className="btn-icon-sm"
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
                background: showHistory ? 'var(--accent-bg-strong)' : undefined,
                color: showHistory ? 'var(--accent)' : undefined,
                flexShrink: 0,
              }}
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
                title={`${errorCount} error(s) detected \u2014 click to dismiss`}
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

          {/* Close button -- embed/side panel mode */}
          {isEmbed && (
            <button
              className="btn-close"
              onClick={() => window.parent.postMessage({ type: 'hemingweight-close' }, '*')}
              style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0 }}
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
              gap: 12, zIndex: 10, background: 'var(--bg-panel)',
            }}>
              <img src="/logo.png" alt="Hemingweight" style={{ width: 56, height: 56 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Hemingweight</div>
              <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
                Think of something you want to build
              </div>
              <a
                href="/docs"
                target="_blank"
                className="link-hover"
                style={{
                  marginTop: 8, fontSize: 12, color: '#71717a',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M1 3c1.5-1 3.5-1 5 0v10c-1.5-1-3.5-1-5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 3c-1.5-1-3.5-1-5 0v10c1.5-1 3.5-1 5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 3v10" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                Documentation
              </a>
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
              background: 'var(--bg-panel)', overflow: 'auto',
            }}>
              <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="var(--accent)" strokeWidth="1.3" />
                    <path d="M8 5v3.5l2.5 1.5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Version History
                </div>
                <button
                  className="btn-close"
                  onClick={() => setShowHistory(false)}
                  style={{ width: 24, height: 24, borderRadius: 4 }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {historyLoading ? (
                <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Loading history...</div>
              ) : historyCommits.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
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
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => connectToProject(selectedProject)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}
            >
              Restart Session
            </button>
          </div>
        )}

        {/* Bottom bar: git action */}
        {selectedProject && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center',
            justifyContent: 'flex-end',
          }}>
            {/* Git action split button */}
            <div style={{ display: 'flex', position: 'relative' }}>
              <button
                onClick={async () => {
                  if (!selectedProject) return;
                  try {
                    if (gitAction === 'commit') {
                      await fetch('/api/git/commit-and-push', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath: selectedProject.path, commitOnly: true }),
                      });
                      termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Committed.\x1b[0m');
                    } else if (gitAction === 'push') {
                      await fetch('/api/git/push', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath: selectedProject.path }),
                      });
                      termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Pushed to GitHub.\x1b[0m');
                    } else {
                      await fetch('/api/git/commit-and-push', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath: selectedProject.path }),
                      });
                      termRef.current?.writeln('\r\n\x1b[38;2;224;122;75m  Committed & pushed.\x1b[0m');
                    }
                  } catch {}
                }}
                className="btn-primary"
                style={{
                  height: 34, padding: '0 14px', borderRadius: '8px 0 0 8px',
                  fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="8" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 4.5v7" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {{ 'commit-push': 'Commit & Push', 'commit': 'Commit', 'push': 'Push' }[gitAction]}
              </button>
              <button
                onClick={() => setShowGitActions(v => !v)}
                style={{
                  height: 34, width: 28, borderRadius: '0 8px 8px 0',
                  background: 'var(--accent-dark)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: showGitActions ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showGitActions && (
                <div className="dropdown-panel" style={{
                  position: 'absolute', bottom: '100%', right: 0,
                  marginBottom: 6,
                  minWidth: 200, padding: '4px',
                  boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
                }}>
                  {[
                    { key: 'commit-push' as const, label: 'Commit & Push', desc: 'Save and upload to GitHub' },
                    { key: 'commit' as const, label: 'Commit', desc: 'Save a local snapshot' },
                    { key: 'push' as const, label: 'Push', desc: 'Upload commits to GitHub' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      className="git-action-item"
                      onClick={() => { setGitAction(opt.key); setShowGitActions(false); }}
                      style={{
                        background: gitAction === opt.key ? 'var(--accent-bg)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {opt.label}
                        {gitAction === opt.key && (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#71717a' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Preview Panel -- hidden in embed mode */}
      {!isEmbed && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Preview Toolbar */}
        <div className="toolbar" style={{ background: 'var(--bg-panel)' }}>
          {/* Claw logo -- shown in toolbar when chat is collapsed */}
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
              <img src="/logo.png" alt="Hemingweight" style={{ width: 24, height: 24 }} />
            </button>
          )}

          {/* Toggle chat panel */}
          <button
            onClick={() => setChatOpen(o => !o)}
            className="btn-icon"
            style={{
              background: chatOpen ? 'var(--bg-input)' : 'var(--accent)',
              color: chatOpen ? 'var(--text-tertiary)' : '#fff',
              flexShrink: 0,
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
            background: 'var(--bg-input)',
            borderRadius: 8,
            padding: 2,
            gap: 2,
          }}>
            {(['preview', 'code', 'claude'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightPanel(tab)}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: rightPanel === tab ? 'var(--accent)' : 'transparent',
                  color: rightPanel === tab ? '#fff' : '#71717a',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tab === 'claude' ? 'CLAUDE.md' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            {/* Integrations dropdown */}
            <div ref={integrationsRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowIntegrations(v => !v); if (showIntegrations) setIntegrationSettings(null); }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: showIntegrations ? 'var(--accent)' : 'transparent',
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
              <IntegrationsDropdown
                show={showIntegrations}
                integrationSettings={integrationSettings}
                setIntegrationSettings={setIntegrationSettings}
                gitData={gitData}
                supabaseConnected={supabaseConnected}
                supabaseUrl={supabaseUrl}
                setSupabaseUrl={setSupabaseUrl}
                supabaseAnonKey={supabaseAnonKey}
                setSupabaseAnonKey={setSupabaseAnonKey}
                supabaseServiceKey={supabaseServiceKey}
                setSupabaseServiceKey={setSupabaseServiceKey}
                supabaseConnecting={supabaseConnecting}
                setSupabaseConnecting={setSupabaseConnecting}
                supabaseConnectMsg={supabaseConnectMsg}
                setSupabaseConnectMsg={setSupabaseConnectMsg}
                setSupabaseConnected={setSupabaseConnected}
                gitRepoUrl={gitRepoUrl}
                setGitRepoUrl={setGitRepoUrl}
                gitConnecting={gitConnecting}
                setGitConnecting={setGitConnecting}
                gitConnectMsg={gitConnectMsg}
                setGitConnectMsg={setGitConnectMsg}
                selectedProjectPath={selectedProject?.path || ''}
                setGitData={setGitData}
                setRightPanel={setRightPanel}
                setShowIntegrations={setShowIntegrations}
              />
            </div>
          </div>

          {/* Page navigation bar */}
          <div ref={pageDropdownRef} style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: 'var(--bg-input)', borderRadius: 8,
            padding: '0 12px', height: 34, gap: 8,
            position: 'relative',
          }}>
            {previewRunning ? (
              <>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', flexShrink: 0 }} />
                <button
                  onClick={() => setShowPageDropdown(v => !v)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                    color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-mono)',
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
                    marginTop: 4, background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                    borderRadius: 8, overflow: 'hidden', zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    maxHeight: 320, overflowY: 'auto',
                  }}>
                    {pages.map(p => (
                      <button
                        key={p.path}
                        className="page-dropdown-item"
                        onClick={() => {
                          setCurrentPage(p.path);
                          setShowPageDropdown(false);
                          setPreviewKey(k => k + 1);
                        }}
                        style={{
                          background: currentPage === p.path ? 'var(--accent-bg)' : undefined,
                          color: currentPage === p.path ? 'var(--accent)' : undefined,
                        }}
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
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {selectedProject ? 'Ready to preview' : 'Select a project'}
              </span>
            )}
          </div>

          {/* Refresh */}
          <button
            className="btn-icon"
            onClick={() => setPreviewKey(k => k + 1)}
            title="Refresh preview"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.8M13.5 2v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Open in new tab */}
          <button
            className="btn-icon"
            onClick={() => { if (previewRunning && previewUrl) window.open(previewUrl + (currentPage === '/' ? '' : currentPage), '_blank'); }}
            title="Open in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3v10h10v-3M9 3h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Help / Docs dropdown */}
          <div ref={docsMenuRef} style={{ position: 'relative' }}>
            <button
              className="btn-icon"
              onClick={() => setShowDocsMenu(v => !v)}
              style={{
                background: showDocsMenu ? 'var(--accent)' : undefined,
                color: showDocsMenu ? '#fff' : undefined,
              }}
              title="Help & Docs"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M1 3c1.5-1 3.5-1 5 0v10c-1.5-1-3.5-1-5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 3c-1.5-1-3.5-1-5 0v10c1.5-1 3.5-1 5 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 3v10" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
            <DocsMenu
              show={showDocsMenu}
              onClose={() => setShowDocsMenu(false)}
            />
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
              <circle cx="8" cy="8" r="6" stroke="var(--blue)" strokeWidth="1.3" />
              <path d="M8 5v3.5l2.5 1.5" stroke="var(--blue)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 12, color: '#93bbfd', flex: 1 }}>
              Viewing <strong style={{ color: '#fff' }}>{previewingVersion.short}</strong> {'\u2014'} {previewingVersion.message}
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
              className="btn-primary"
              style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, background: '#2563eb' }}
            >
              Back to current
            </button>
          </div>
        )}

        {/* Content area -- Preview, Code, CLAUDE.md, or Git */}
        <div style={{ flex: 1, background: 'var(--bg-deepest)', position: 'relative' }}>
          {rightPanel === 'claude' && selectedProject ? (
            <ClaudeMdPanel
              claudeMd={claudeMd}
              claudeMdLoading={claudeMdLoading}
              claudeMdEditing={claudeMdEditing}
              claudeMdDraft={claudeMdDraft}
              claudeMdSaving={claudeMdSaving}
              setClaudeMdDraft={setClaudeMdDraft}
              setClaudeMdEditing={setClaudeMdEditing}
              saveClaudeMd={saveClaudeMd}
              projectName={selectedProject.name}
            />
          ) : rightPanel === 'git' && selectedProject ? (
            <GitPanel
              gitData={gitData}
              selectedProjectPath={selectedProject.path}
              gitRepoUrl={gitRepoUrl}
              setGitRepoUrl={setGitRepoUrl}
              gitConnecting={gitConnecting}
              setGitConnecting={setGitConnecting}
              gitConnectMsg={gitConnectMsg}
              setGitConnectMsg={setGitConnectMsg}
              setGitData={setGitData}
              gitPushing={gitPushing}
              setGitPushing={setGitPushing}
              gitPushMsg={gitPushMsg}
              setGitPushMsg={setGitPushMsg}
              gitHistory={gitHistory}
              setGitHistory={setGitHistory}
              gitRestoring={gitRestoring}
              setGitRestoring={setGitRestoring}
            />
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
                    className="btn-primary"
                    style={{
                      padding: '12px 28px', borderRadius: 10,
                      fontSize: 14,
                      cursor: previewLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 0 20px rgba(224, 122, 75, 0.2)',
                    }}
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
                  <div style={{ fontSize: 12, color: 'var(--border-default)' }}>
                    Launches the dev server and loads the preview
                  </div>
                  {previewError && (
                    <div style={{ fontSize: 12, color: 'var(--error)', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
                      {previewError}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: 'var(--border-default)' }}>
                    Select a project to get started
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bg-input)' }}>
                    Click "Run Preview" after selecting a project
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>}

      {/* New Project Modal */}
      <NewProjectModal
        show={showNewProject}
        onClose={() => setShowNewProject(false)}
        projectsDir={projectsDir}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectError={newProjectError}
        createNewProject={createNewProject}
      />
    </div>
  );
}

export default App;
