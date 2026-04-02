import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

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

  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  // Refit terminal when chat panel toggles
  useEffect(() => {
    setTimeout(() => fitAddonRef.current?.fit(), 300);
  }, [chatOpen]);

  const connectToProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowProjectPicker(false);
    setStatus('connecting');

    if (wsRef.current) wsRef.current.close();

    const term = termRef.current;
    if (term) {
      term.clear();
      term.writeln(`\x1b[38;2;224;122;75m  Connecting to: ${project.name}\x1b[0m`);
      term.writeln(`\x1b[38;5;60m  ${project.path}\x1b[0m\r\n`);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.DEV ? 'localhost:3456' : window.location.host;
    const ws = new WebSocket(`${protocol}//${wsHost}`);
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
      if (msg.type === 'output') term?.write(msg.data);
      if (msg.type === 'exit') {
        setStatus('exited');
        term?.writeln('\r\n\x1b[38;5;60m  Session ended.\x1b[0m');
      }
    };

    ws.onclose = () => { if (status === 'running') setStatus('exited'); };
    ws.onerror = () => {
      setStatus('idle');
      term?.writeln('\r\n\x1b[31m  Connection error.\x1b[0m');
    };
  }, [status]);

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
              <img src="/logo.svg" alt="Clawable" style={{ width: 28, height: 28 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e4e4ef', whiteSpace: 'nowrap' }}>Clawable</span>
            </div>
          )}

          {/* Project dropdown */}
          <div style={{ position: 'relative', flex: 1 }}>
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

          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: statusDot,
              boxShadow: status === 'running' ? `0 0 6px ${statusDot}` : 'none',
            }} />
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
              <img src="/logo.svg" alt="Clawable" style={{ width: 56, height: 56 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#e4e4ef' }}>Clawable</div>
              <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
                Think of something you want to build with Claude Code
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
              <img src="/logo.svg" alt="Clawable" style={{ width: 24, height: 24 }} />
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
            <button style={{
              padding: '6px 16px', borderRadius: 6, border: 'none',
              background: '#e07a4b', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Preview
            </button>
            <button style={{
              padding: '6px 16px', borderRadius: 6, border: 'none',
              background: 'transparent', color: '#71717a',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              Code
            </button>
          </div>

          {/* URL bar */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: '#27272a', borderRadius: 8,
            padding: '0 12px', height: 34, gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 8h12M8 2a10 10 0 0 1 3 6 10 10 0 0 1-3 6 10 10 0 0 1-3-6 10 10 0 0 1 3-6z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <input
              type="text"
              value={previewUrl}
              onChange={e => setPreviewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setPreviewKey(k => k + 1); }}
              placeholder="http://localhost:3000"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#a1a1aa', fontSize: 13, outline: 'none',
                fontFamily: "'SF Mono', Menlo, monospace",
              }}
            />
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
            onClick={() => { if (previewUrl) window.open(previewUrl, '_blank'); }}
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
        </div>

        {/* Preview iframe */}
        <div style={{ flex: 1, background: '#09090b', position: 'relative' }}>
          {previewUrl ? (
            <iframe
              key={previewKey}
              src={previewUrl}
              style={{
                width: '100%', height: '100%',
                border: 'none', background: '#fff',
              }}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12,
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
              <div style={{ fontSize: 14, color: '#3f3f46' }}>
                Enter a URL above to preview your project
              </div>
              <div style={{ fontSize: 12, color: '#27272a' }}>
                e.g. http://localhost:3000
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}

export default App;
