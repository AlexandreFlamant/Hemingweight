interface Project {
  name: string;
  path: string;
}

function MainMenu({
  show, mainMenuTab, setMainMenuTab, projectSearch, setProjectSearch,
  filteredProjects, selectedProject, connectToProject, onNewProject, onClose,
  settingsDir, setSettingsDir, projectsDir, saveSettingsDir, settingsDirSaving, settingsDirMsg,
}: {
  show: boolean;
  mainMenuTab: 'projects' | 'settings';
  setMainMenuTab: (tab: 'projects' | 'settings') => void;
  projectSearch: string;
  setProjectSearch: (v: string) => void;
  filteredProjects: Project[];
  selectedProject: Project | null;
  connectToProject: (p: Project) => void;
  onNewProject: () => void;
  onClose: () => void;
  settingsDir: string;
  setSettingsDir: (v: string) => void;
  projectsDir: string;
  saveSettingsDir: () => void;
  settingsDirSaving: boolean;
  settingsDirMsg: string;
}) {
  if (!show) return null;

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: 4,
      background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 8,
      overflow: 'hidden', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      width: 300, display: 'flex', flexDirection: 'column',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)' }}>
        {(['projects', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainMenuTab(tab)}
            style={{
              flex: 1, padding: '10px 0', background: 'transparent', border: 'none',
              borderBottom: mainMenuTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: mainMenuTab === tab ? 'var(--accent)' : '#71717a',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {mainMenuTab === 'projects' && (
        <>
          <input
            type="text"
            id="project-search"
            name="project-search"
            placeholder="Search projects..."
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            autoFocus
            style={{
              padding: '10px 14px', background: 'transparent', border: 'none',
              borderBottom: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <div style={{ overflowY: 'auto', maxHeight: 300 }}>
            <button
              className="menu-project-item"
              onClick={() => { onNewProject(); onClose(); }}
              style={{
                borderBottom: '1px solid var(--border-default)',
                color: 'var(--accent)', fontWeight: 600,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New Project
            </button>
            {filteredProjects.map(p => (
              <button
                key={p.path}
                className="menu-project-item"
                onClick={() => { connectToProject(p); onClose(); }}
                style={{
                  background: selectedProject?.path === p.path ? 'var(--accent-bg)' : undefined,
                  color: selectedProject?.path === p.path ? 'var(--accent)' : undefined,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43679 3 6.69114 3.10536 6.87868 3.29289L7.70711 4.12132C7.89464 4.30886 8.149 4.41421 8.41421 4.41421H13C13.5523 4.41421 14 4.86193 14 5.41421V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      {mainMenuTab === 'settings' && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Projects Root Path
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 6 }}>
              New projects will be created inside this folder.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={settingsDir}
                onChange={e => { setSettingsDir(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter' && settingsDir) saveSettingsDir(); }}
                className="input-field-mono"
                style={{
                  flex: 1, padding: '8px 10px', background: '#1a1a1e',
                  fontSize: 13,
                }}
              />
              <button
                onClick={saveSettingsDir}
                disabled={!settingsDir || settingsDirSaving || settingsDir === projectsDir}
                className="btn-primary"
                style={{
                  padding: '8px 14px', borderRadius: 6, fontSize: 12,
                  whiteSpace: 'nowrap',
                  background: settingsDir && settingsDir !== projectsDir ? undefined : 'var(--border-default)',
                  cursor: settingsDir && settingsDir !== projectsDir ? 'pointer' : 'not-allowed',
                }}
              >
                {settingsDirSaving ? '...' : 'Save'}
              </button>
            </div>
            {settingsDirMsg && (
              <div style={{ fontSize: 11, marginTop: 4, color: settingsDirMsg === 'Saved' ? 'var(--success)' : 'var(--error)' }}>
                {settingsDirMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MainMenu;
