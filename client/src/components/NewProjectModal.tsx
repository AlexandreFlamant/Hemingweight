function NewProjectModal({ show, onClose, projectsDir, newProjectName, setNewProjectName, newProjectError, createNewProject }: {
  show: boolean;
  onClose: () => void;
  projectsDir: string;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  newProjectError: string;
  createNewProject: () => void;
}) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-input)', borderRadius: 12, padding: 24,
        width: 400, border: '1px solid var(--border-default)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
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
          className="input-field-mono"
          style={{ width: '100%', fontSize: 14, background: 'var(--bg-panel)' }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Creates {projectsDir}/{newProjectName || '...'}
        </div>
        {newProjectError && (
          <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>{newProjectError}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn-outline"
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={createNewProject}
            disabled={!newProjectName}
            className="btn-primary"
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13,
              cursor: newProjectName ? 'pointer' : 'not-allowed',
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewProjectModal;
