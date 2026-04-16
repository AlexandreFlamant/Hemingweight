import { useState, useEffect } from 'react';

interface FolderPickerProps {
  currentPath: string;
  onSelect: (path: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export default function FolderPicker({ currentPath, onSelect, onCancel, compact }: FolderPickerProps) {
  const cleanPath = currentPath.replace(/\/+$/, '') || '~';
  const [browsePath, setBrowsePath] = useState(cleanPath);
  const [dirs, setDirs] = useState<string[]>([]);
  const [display, setDisplay] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/directories?path=${encodeURIComponent(browsePath)}`)
      .then(r => r.json())
      .then(data => {
        setDirs(data.dirs || []);
        setDisplay(data.display || browsePath);
        setParent(data.parent || null);
        setBrowsePath(data.path || browsePath);
      })
      .catch(() => setDirs([]))
      .finally(() => setLoading(false));
  }, [browsePath]);

  const pathParts = display.split('/').filter(Boolean);

  return (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 8,
      background: 'var(--bg-panel)', overflow: 'hidden',
    }}>
      {/* Breadcrumb path */}
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 4,
        flexWrap: 'wrap',
      }}>
        {parent && (
          <button
            onClick={() => setBrowsePath(parent)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              flexShrink: 0, borderRadius: 3,
            }}
            title="Go up"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <span style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pathParts.length === 0 ? '~' : pathParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>/</span>}
              <span style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : undefined }}>{part}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Directory list */}
      <div style={{ maxHeight: compact ? 140 : 220, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Loading...</div>
        ) : dirs.length === 0 ? (
          <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Empty folder</div>
        ) : (
          dirs.map(dir => (
            <button
              key={dir}
              onClick={() => setBrowsePath(browsePath + '/' + dir)}
              className="menu-project-item"
              style={{ padding: '7px 12px', fontSize: 12, gap: 8 }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
                <path d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43679 3 6.69114 3.10536 6.87868 3.29289L7.70711 4.12132C7.89464 4.30886 8.149 4.41421 8.41421 4.41421H13C13.5523 4.41421 14 4.86193 14 5.41421V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{dir}</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.2 }}>
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))
        )}
      </div>

      {/* Action bar */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 6,
        justifyContent: 'flex-end',
      }}>
        {onCancel && (
          <button
            className="btn-ghost"
            onClick={onCancel}
            style={{ padding: '5px 10px', borderRadius: 5, fontSize: 11, color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        )}
        <button
          className="btn-primary"
          onClick={() => onSelect(display)}
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11 }}
        >
          Use this folder
        </button>
      </div>
    </div>
  );
}
