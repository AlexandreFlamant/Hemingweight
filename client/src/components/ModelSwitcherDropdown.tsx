import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export type ModelKey = 'claude' | 'mistral' | 'openai' | 'gemini';

export interface ModelStatus {
  name: string;
  state: 'ready' | 'soon';
  installed: boolean;
  path?: string | null;
  cli?: string;
}

export type ModelsMap = Partial<Record<ModelKey, ModelStatus>>;

interface ModelMeta {
  key: ModelKey;
  name: string;
  description: string;
  iconBg: string;
  iconBorder?: string;
  icon: ReactNode;
  defaultState: 'ready' | 'soon';
}

const MODELS: ModelMeta[] = [
  {
    key: 'claude',
    name: 'Claude',
    description: 'Anthropic\u2019s assistant via Claude Code CLI.',
    iconBg: '#1c1c1c',
    iconBorder: '1px solid var(--border-subtle)',
    defaultState: 'ready',
    icon: (
      <svg viewBox="0 0 32 32" width="22" height="22" fill="#D97757" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(16 16)">
          <ellipse rx="2" ry="13" />
          <ellipse rx="2" ry="13" transform="rotate(45)" />
          <ellipse rx="2" ry="13" transform="rotate(90)" />
          <ellipse rx="2" ry="13" transform="rotate(135)" />
        </g>
      </svg>
    ),
  },
  {
    key: 'mistral',
    name: 'Mistral',
    description: 'Mistral Vibe CLI, runs against La Plateforme.',
    iconBg: '#1c1c1c',
    iconBorder: '1px solid var(--border-subtle)',
    defaultState: 'ready',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="#FA500F" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" />
      </svg>
    ),
  },
  {
    key: 'openai',
    name: 'OpenAI',
    description: 'GPT models via the Codex CLI.',
    iconBg: '#fff',
    defaultState: 'ready',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="#000" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
  },
  {
    key: 'gemini',
    name: 'Gemini',
    description: 'Google\u2019s Gemini CLI.',
    iconBg: '#1c1c1c',
    iconBorder: '1px solid var(--border-subtle)',
    defaultState: 'ready',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z" />
      </svg>
    ),
  },
];

type RowMode = 'current' | 'switch' | 'install' | 'soon';

function rowMode(meta: ModelMeta, selected: ModelKey, status?: ModelStatus): RowMode {
  if (meta.defaultState === 'soon') return 'soon';
  if (status?.state === 'soon') return 'soon';
  if (meta.key === selected) return 'current';
  if (status?.installed) return 'switch';
  return 'install';
}

function ModelSwitcherDropdown({
  show,
  anchorRef,
  models,
  selectedModel,
  onSwitch,
  onInstall,
}: {
  show: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  models: ModelsMap;
  selectedModel: ModelKey;
  onSwitch: (key: ModelKey) => void;
  onInstall: (key: ModelKey) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!show) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 420;
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPos({ top: rect.bottom + 6, left: Math.max(8, left) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [show, anchorRef]);

  const panelRef = useRef<HTMLDivElement>(null);

  if (!show || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left,
        width: 420,
        background: 'var(--bg-dropdown)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, zIndex: 1000,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', maxHeight: 420,
      }}
    >
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Switch model</div>
        <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>Pick which LLM powers your session.</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {MODELS.map((meta, idx) => {
          const status = models[meta.key];
          const mode = rowMode(meta, selectedModel, status);
          const dim = mode === 'soon';
          const clickable = mode === 'switch' || mode === 'install';

          return (
            <div key={meta.key}>
              <div
                onClick={() => {
                  if (mode === 'switch') onSwitch(meta.key);
                  else if (mode === 'install') onInstall(meta.key);
                }}
                className={clickable ? 'integration-item' : undefined}
                style={{
                  width: '100%', padding: '12px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: dim ? 0.45 : 1,
                  cursor: clickable ? 'pointer' : 'default',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: meta.iconBg, border: meta.iconBorder,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {meta.name}
                    {mode === 'soon' && <span className="badge-soon">SOON</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>
                    {meta.description}
                  </div>
                </div>
                {mode === 'current' && (
                  <div className="badge-connected">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5l3.5 3.5L13 4" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Current
                  </div>
                )}
                {mode === 'switch' && (
                  <div style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                    background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)',
                  }}>
                    Switch
                  </div>
                )}
                {mode === 'install' && (
                  <div style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                    background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)',
                  }}>
                    Install
                  </div>
                )}
                {mode === 'soon' && (
                  <div style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
                    background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
                  }}>
                    Switch
                  </div>
                )}
              </div>
              {idx < MODELS.length - 1 && (
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 12px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

export default ModelSwitcherDropdown;
