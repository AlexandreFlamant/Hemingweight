import { useState, useEffect, useMemo, useRef } from 'react';

interface Column {
  id: string;
  title: string;
  position: number;
}
interface Card {
  id: string;
  columnId: string;
  title: string;
  desc: string;
  createdAt: number;
}
interface KanbanData {
  columns: Column[];
  cards: Card[];
}

const DEFAULT_DATA = (): KanbanData => ({
  columns: [
    { id: 'todo', title: 'Todo', position: 0 },
    { id: 'doing', title: 'Doing', position: 1 },
    { id: 'done', title: 'Done', position: 2 },
  ],
  cards: [],
});

// Per-project storage. We key off the absolute project path so two projects
// with the same name in different folders never share a board.
const storageKeyFor = (projectPath: string) => `hw.kanban.${projectPath}`;

function loadData(projectPath: string): KanbanData {
  try {
    const raw = localStorage.getItem(storageKeyFor(projectPath));
    if (!raw) return DEFAULT_DATA();
    const parsed = JSON.parse(raw) as KanbanData;
    if (!parsed.columns || !parsed.cards) return DEFAULT_DATA();
    return parsed;
  } catch {
    return DEFAULT_DATA();
  }
}

function saveData(projectPath: string, data: KanbanData) {
  try { localStorage.setItem(storageKeyFor(projectPath), JSON.stringify(data)); } catch {}
}

const newId = () => Math.random().toString(36).slice(2, 10);

interface KanbanPanelProps {
  projectPath: string;
  projectName: string;
  onRun?: (cards: Card[], opts: { parallel: boolean }) => void;
}

export default function KanbanPanel({ projectPath, projectName, onRun }: KanbanPanelProps) {
  const [data, setData] = useState<KanbanData>(() => loadData(projectPath));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const draggedCardRef = useRef<{ cardId: string; fromColId: string } | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [parallel, setParallel] = useState(false);
  // The save effect runs in the same commit as project-switch with stale `data`
  // (the previous project's). Skipping that one tick keeps us from writing the
  // old project's cards under the new project's storage key.
  const skipNextSaveRef = useRef(false);

  // Re-load when project changes (each project has its own board)
  useEffect(() => {
    setData(loadData(projectPath));
    skipNextSaveRef.current = true;
    setSelectedIds(new Set());
    setEditingCardId(null);
  }, [projectPath]);

  // Persist on every change. Guarded against the same-tick stale write above.
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveData(projectPath, data);
  }, [projectPath, data]);

  const sortedColumns = useMemo(
    () => [...data.columns].sort((a, b) => a.position - b.position),
    [data.columns],
  );

  const cardsByColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const col of sortedColumns) map[col.id] = [];
    for (const card of data.cards) {
      if (map[card.columnId]) map[card.columnId].push(card);
      else {
        // orphan card — re-home to first column
        if (sortedColumns[0]) map[sortedColumns[0].id].push(card);
      }
    }
    return map;
  }, [data.cards, sortedColumns]);

  // Strict resolution for the Doing/Done columns — only matches when we're
  // sure (literal id or common rename pattern). Doing is also used as the
  // auto-move target for Run.
  const doingColumnId = useMemo(() => {
    const match = sortedColumns.find(c =>
      c.id === 'doing' || /doing|in[\s-_]?progress|wip|active/i.test(c.title)
    );
    return match?.id ?? null;
  }, [sortedColumns]);
  const doneColumnId = useMemo(() => {
    const match = sortedColumns.find(c =>
      c.id === 'done' || /done|complete|finished|shipped|closed/i.test(c.title)
    );
    return match?.id ?? null;
  }, [sortedColumns]);
  // Select all only picks Todo cards. Match the literal id, common rename
  // patterns, or as a last resort the first column when it isn't already
  // claimed by Doing or Done (handles default boards where the user renamed
  // "Todo" to something we don't recognise but kept it leftmost).
  const todoColumnId = useMemo(() => {
    const direct = sortedColumns.find(c =>
      c.id === 'todo' || /^to[\s\-_]?do$/i.test(c.title)
    );
    if (direct) return direct.id;
    const first = sortedColumns[0];
    if (first && first.id !== doingColumnId && first.id !== doneColumnId) return first.id;
    return null;
  }, [sortedColumns, doingColumnId, doneColumnId]);

  const runnableCards = useMemo(
    () => todoColumnId ? data.cards.filter(c => c.columnId === todoColumnId) : [],
    [data.cards, todoColumnId],
  );

  const totalCards = data.cards.length;
  const runnableCount = runnableCards.length;
  const allSelected = runnableCount > 0 && runnableCards.every(c => selectedIds.has(c.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(runnableCards.map(c => c.id)));
  };

  const addCard = (columnId: string) => {
    const card: Card = {
      id: newId(),
      columnId,
      title: 'New task',
      desc: '',
      createdAt: Date.now(),
    };
    setData(d => ({ ...d, cards: [...d.cards, card] }));
    setEditingCardId(card.id);
  };

  const updateCard = (id: string, patch: Partial<Card>) => {
    setData(d => ({
      ...d,
      cards: d.cards.map(c => c.id === id ? { ...c, ...patch } : c),
    }));
  };

  const deleteCard = (id: string) => {
    setData(d => ({ ...d, cards: d.cards.filter(c => c.id !== id) }));
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (editingCardId === id) setEditingCardId(null);
  };

  const addColumn = () => {
    const title = window.prompt('Column name?');
    if (!title) return;
    const position = (sortedColumns[sortedColumns.length - 1]?.position ?? -1) + 1;
    setData(d => ({ ...d, columns: [...d.columns, { id: newId(), title, position }] }));
  };

  const deleteColumn = (id: string) => {
    if (data.columns.length <= 1) return;
    if (!window.confirm('Delete this column and all its cards?')) return;
    setData(d => ({
      ...d,
      columns: d.columns.filter(c => c.id !== id),
      cards: d.cards.filter(c => c.columnId !== id),
    }));
  };

  const renameColumn = (id: string, title: string) => {
    setData(d => ({ ...d, columns: d.columns.map(c => c.id === id ? { ...c, title } : c) }));
  };

  // ── Drag & drop ────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, cardId: string, fromColId: string) => {
    draggedCardRef.current = { cardId, fromColId };
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('dragging');
  };
  const onDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    setDragOverColId(null);
  };
  const onDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColId(colId);
  };
  const onDragLeave = (colId: string) => {
    setDragOverColId(prev => prev === colId ? null : prev);
  };
  const onDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    const dragged = draggedCardRef.current;
    draggedCardRef.current = null;
    if (!dragged || dragged.fromColId === targetColId) return;
    updateCard(dragged.cardId, { columnId: targetColId });
  };

  // For the auto-move target on Run we accept a positional fallback (column at
  // index 1) when the user has remixed all titles — better to land somewhere
  // than nowhere. Filtering uses the strict id above instead.
  const findDoingColumnId = (): string | null => doingColumnId ?? sortedColumns[1]?.id ?? null;

  const runSelected = () => {
    if (!onRun) return;
    const cards = data.cards.filter(c => selectedIds.has(c.id));
    if (cards.length === 0) return;
    const doingId = findDoingColumnId();
    if (doingId) {
      const ids = new Set(cards.map(c => c.id));
      setData(d => ({
        ...d,
        cards: d.cards.map(c => (ids.has(c.id) && c.columnId !== doingId)
          ? { ...c, columnId: doingId } : c),
      }));
    }
    onRun(cards, { parallel });
  };

  const editingCard = editingCardId ? data.cards.find(c => c.id === editingCardId) : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden',
      background: 'var(--bg-deepest)',
    }}>
      {/* Filter / action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Tasks
        </span>
        <span
          title={projectPath}
          style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-input)',
            maxWidth: 200, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {projectName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {totalCards} card{totalCards === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--text-tertiary)',
          padding: '4px 8px', borderRadius: 6,
          cursor: runnableCount > 0 ? 'pointer' : 'not-allowed',
          opacity: runnableCount > 0 ? 1 : 0.4,
        }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={selectAll}
            disabled={runnableCount === 0}
            style={{ accentColor: 'var(--accent)' }}
          />
          Select all
        </label>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--text-tertiary)',
          padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={parallel}
            onChange={e => setParallel(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Parallel Run
        </label>
        <button
          onClick={runSelected}
          disabled={selectedIds.size === 0}
          title={parallel
            ? 'Open each selected task in its own terminal tab'
            : 'Send selected tasks to the active terminal as one prompt'}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: selectedIds.size > 0 ? 'var(--accent)' : 'var(--bg-input)',
            color: selectedIds.size > 0 ? '#fff' : 'var(--text-tertiary)',
            fontSize: 12, fontWeight: 600,
            cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M3 2l6 4-6 4V2z" fill="currentColor" />
          </svg>
          Run {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </button>
        <button
          onClick={addColumn}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)',
            background: 'transparent', color: 'var(--text-tertiary)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
          title="Add column"
        >
          + Column
        </button>
      </div>

      {/* Board */}
      <div style={{
        display: 'flex', gap: 12, padding: 16, overflowX: 'auto', overflowY: 'hidden',
        flex: 1, alignItems: 'flex-start', minHeight: 0,
      }}>
        {sortedColumns.map(col => {
          const cards = cardsByColumn[col.id] || [];
          const isOver = dragOverColId === col.id;
          return (
            <div
              key={col.id}
              style={{
                minWidth: 270, maxWidth: 300, width: 270,
                flexShrink: 0,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                display: 'flex', flexDirection: 'column',
                maxHeight: '100%',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}>
                {editingColumnId === col.id ? (
                  <input
                    autoFocus
                    value={editColTitle}
                    onChange={e => setEditColTitle(e.target.value)}
                    onBlur={() => {
                      if (editColTitle.trim()) renameColumn(col.id, editColTitle.trim());
                      setEditingColumnId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingColumnId(null);
                    }}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: 'var(--text-primary)',
                      background: 'var(--bg-input)', border: '1px solid var(--accent)',
                      borderRadius: 4, padding: '2px 6px', outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => { setEditingColumnId(col.id); setEditColTitle(col.title); }}
                    style={{
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: 'var(--text-secondary)',
                      cursor: 'text',
                    }}
                    title="Double-click to rename"
                  >
                    {col.title}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {cards.length}
                  </span>
                  {data.columns.length > 1 && (
                    <button
                      onClick={() => deleteColumn(col.id)}
                      title="Delete column"
                      style={{
                        width: 16, height: 16, padding: 0, border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', borderRadius: 3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Card list */}
              <div
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={() => onDragLeave(col.id)}
                onDrop={e => onDrop(e, col.id)}
                style={{
                  padding: 6, display: 'flex', flexDirection: 'column', gap: 6,
                  overflowY: 'auto', flex: 1, minHeight: 40,
                  background: isOver ? 'var(--accent-bg)' : 'transparent',
                  transition: 'background 100ms',
                }}
              >
                {cards.map(card => {
                  const selected = selectedIds.has(card.id);
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={e => onDragStart(e, card.id, col.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setEditingCardId(card.id)}
                      style={{
                        background: 'var(--bg-input)',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        borderRadius: 6, padding: '10px 12px',
                        cursor: 'grab', position: 'relative',
                        transition: 'all 100ms',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onClick={e => e.stopPropagation()}
                          onChange={() => toggleSelect(card.id)}
                          style={{ accentColor: 'var(--accent)', marginTop: 2, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                            marginBottom: card.desc ? 4 : 0, lineHeight: 1.4,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {card.title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Untitled</span>}
                          </div>
                          {card.desc && (
                            <div style={{
                              fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}>
                              {card.desc}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                        className="kcard-delete"
                        title="Delete"
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 18, height: 18, padding: 0, border: 'none',
                          background: 'transparent', color: 'var(--text-muted)',
                          cursor: 'pointer', borderRadius: 3, opacity: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'opacity 100ms',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add card */}
              <div
                onClick={() => addCard(col.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 32, margin: '2px 6px 6px',
                  borderRadius: 6, fontSize: 12, color: 'var(--text-tertiary)',
                  cursor: 'pointer', border: '1px dashed var(--border-subtle)',
                  transition: 'all 100ms',
                }}
              >
                + Add card
              </div>
            </div>
          );
        })}
      </div>

      {/* Card detail modal */}
      {editingCard && (
        <div
          onClick={() => setEditingCardId(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 520, maxWidth: '90%', maxHeight: '85%',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <input
              autoFocus
              value={editingCard.title}
              onChange={e => updateCard(editingCard.id, { title: e.target.value })}
              placeholder="Task title"
              style={{
                fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
                background: 'transparent', border: 'none', outline: 'none',
                padding: '4px 0',
              }}
            />
            <textarea
              value={editingCard.desc}
              onChange={e => updateCard(editingCard.id, { desc: e.target.value })}
              placeholder="Describe what needs to happen..."
              rows={8}
              style={{
                fontSize: 13, color: 'var(--text-primary)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: 10,
                resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={editingCard.columnId}
                onChange={e => updateCard(editingCard.id, { columnId: e.target.value })}
                style={{
                  padding: '6px 10px', borderRadius: 6,
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12, outline: 'none', cursor: 'pointer',
                }}
              >
                {sortedColumns.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => deleteCard(editingCard.id)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: 'transparent', color: 'var(--error)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setEditingCardId(null)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { Card as KanbanCard };
