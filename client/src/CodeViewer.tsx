import { useState, useEffect, useRef, useCallback } from 'react';
import hljs from 'highlight.js/lib/core';

// Register common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);

// Map file extensions to highlight.js language names
function langFromPath(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html', svg: 'xml', xml: 'xml',
    css: 'css', scss: 'css', less: 'css',
    json: 'json',
    py: 'python',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    md: 'markdown', mdx: 'markdown',
    yml: 'yaml', yaml: 'yaml',
    sql: 'sql',
  };
  return ext ? map[ext] : undefined;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
}

// File type icon helper
function FileIcon({ name, isDir, isOpen }: { name: string; isDir: boolean; isOpen?: boolean }) {
  if (isDir) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        {isOpen ? (
          <path d="M1.5 4C1.5 3.17 2.17 2.5 3 2.5h3.17a1.5 1.5 0 0 1 1.06.44l.83.83a1.5 1.5 0 0 0 1.06.44H13c.83 0 1.5.67 1.5 1.5v.5H6.5a2 2 0 0 0-1.9 1.37L2.5 12.5V4z" fill="#e07a4b" opacity="0.7" />
        ) : (
          <path d="M2 4C2 3.45 2.45 3 3 3h3.17c.27 0 .52.11.71.29l.83.83c.19.19.44.3.71.3H13c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1V4z" fill="#e07a4b" opacity="0.5" />
        )}
      </svg>
    );
  }

  // Color based on extension
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6',
    js: '#f7df1e', jsx: '#f7df1e', mjs: '#f7df1e',
    css: '#264de4', scss: '#cd6799',
    html: '#e34f26', htm: '#e34f26',
    json: '#a1a1aa', yaml: '#a1a1aa', yml: '#a1a1aa',
    md: '#a1a1aa', mdx: '#a1a1aa',
    py: '#3776ab',
    svg: '#ffb13b',
  };
  const color = colors[ext] || '#71717a';

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 2h5l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.1" fill="none" />
      <path d="M9 2v4h4" stroke={color} strokeWidth="1.1" fill="none" />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  changedFiles,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  changedFiles: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setExpanded(e => !e);
          else onSelect(node);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          paddingLeft: 8 + depth * 16,
          background: isSelected ? 'rgba(224,122,75,0.12)' : 'transparent',
          border: 'none',
          color: isSelected ? '#e07a4b' : '#c4c4d4',
          fontSize: 13,
          fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
          cursor: 'pointer',
          textAlign: 'left',
          lineHeight: '24px',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#27272a'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        {isDir && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}>
            <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!isDir && <span style={{ width: 10, flexShrink: 0 }} />}
        <FileIcon name={node.name} isDir={isDir} isOpen={expanded} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        {!isDir && changedFiles.has(node.path) && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#e07a4b',
            boxShadow: '0 0 4px #e07a4b', flexShrink: 0, marginLeft: 'auto',
          }} title="Recently modified" />
        )}
      </button>
      {isDir && expanded && node.children?.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          changedFiles={changedFiles}
        />
      ))}
    </div>
  );
}

export default function CodeViewer({ projectPath }: { projectPath: string }) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const codeRef = useRef<HTMLElement>(null);
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set());

  // Fetch file tree
  const refreshTree = useCallback(() => {
    fetch(`/api/files/tree?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(setTree)
      .catch(() => {});
  }, [projectPath]);

  useEffect(() => { refreshTree(); }, [refreshTree]);

  // File watcher — auto-refresh open tabs and tree on changes
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/files?path=${encodeURIComponent(projectPath)}`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'fileChange') {
        // Refresh tree on add/delete
        if (msg.event === 'rename' || msg.event === 'delete') {
          refreshTree();
        }

        // Track changed file — add indicator dot
        setChangedFiles(prev => new Set(prev).add(msg.path));
        // Auto-clear indicator after 30 seconds
        setTimeout(() => {
          setChangedFiles(prev => {
            const next = new Set(prev);
            next.delete(msg.path);
            return next;
          });
        }, 30000);

        // Refresh content of any open tab whose file changed
        setTabs(prev => {
          const idx = prev.findIndex(t => t.path === msg.path);
          if (idx === -1) return prev;
          fetch(`/api/files/read?path=${encodeURIComponent(msg.path)}`)
            .then(r => r.json())
            .then(data => {
              if (data.error || !data.content) return;
              setTabs(current =>
                current.map(t => t.path === msg.path ? { ...t, content: data.content } : t)
              );
            })
            .catch(() => {});
          return prev;
        });
      }
    };

    return () => ws.close();
  }, [projectPath, refreshTree]);

  const openFile = useCallback(async (node: FileNode) => {
    // If already open, just switch to it
    const existing = tabs.find(t => t.path === node.path);
    if (existing) {
      setActiveTab(node.path);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/files/read?path=${encodeURIComponent(node.path)}`);
      const data = await resp.json();
      if (data.error) return;

      const newTab: OpenTab = { path: node.path, name: node.name, content: data.content };
      setTabs(prev => [...prev, newTab]);
      setActiveTab(node.path);
    } catch {} finally {
      setLoading(false);
    }
  }, [tabs]);

  const closeTab = useCallback((tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.path !== tabPath);
      if (activeTab === tabPath) {
        setActiveTab(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  }, [activeTab]);

  const activeFile = tabs.find(t => t.path === activeTab);

  // Highlight code when active file changes
  useEffect(() => {
    if (codeRef.current && activeFile) {
      const lang = langFromPath(activeFile.path);
      if (lang) {
        try {
          const result = hljs.highlight(activeFile.content, { language: lang });
          codeRef.current.innerHTML = result.value;
        } catch {
          codeRef.current.textContent = activeFile.content;
        }
      } else {
        codeRef.current.textContent = activeFile.content;
      }
    }
  }, [activeFile?.path, activeFile?.content]);

  // Filter tree nodes by search
  function filterTree(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes;
    const q = query.toLowerCase();
    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.type === 'file' && node.name.toLowerCase().includes(q)) {
        acc.push(node);
      } else if (node.type === 'directory' && node.children) {
        const filtered = filterTree(node.children, query);
        if (filtered.length > 0) {
          acc.push({ ...node, children: filtered });
        }
      }
      return acc;
    }, []);
  }

  const displayTree = filterTree(tree, search);
  const lines = activeFile?.content.split('\n') || [];

  return (
    <div style={{ display: 'flex', position: 'absolute', inset: 0, background: '#18181b' }}>
      {/* File tree sidebar */}
      <div style={{
        width: 240,
        minWidth: 240,
        borderRight: '1px solid #2a2a3a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
          <input
            type="text"
            id="code-search"
            name="code-search"
            placeholder="Search code"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#e4e4ef',
              fontSize: 12,
              outline: 'none',
              fontFamily: "'SF Mono', Menlo, monospace",
            }}
          />
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
          {displayTree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={activeTab}
              onSelect={openFile}
              changedFiles={changedFiles}
            />
          ))}
          {tree.length === 0 && (
            <div style={{ padding: 16, color: '#555570', fontSize: 12, textAlign: 'center' }}>
              No files found
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tabs */}
        {tabs.length > 0 && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #2a2a3a',
            background: '#1a1a1f',
            overflowX: 'auto',
            flexShrink: 0,
          }}>
            {tabs.map(tab => {
              const relPath = tab.path.replace(projectPath, '').replace(/^\//, '');
              return (
                <button
                  key={tab.path}
                  onClick={() => setActiveTab(tab.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    background: tab.path === activeTab ? '#18181b' : 'transparent',
                    border: 'none',
                    borderBottom: tab.path === activeTab ? '2px solid #e07a4b' : '2px solid transparent',
                    color: tab.path === activeTab ? '#e4e4ef' : '#71717a',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: "'SF Mono', Menlo, monospace",
                  }}
                >
                  <span style={{ color: '#a1a1aa', fontSize: 11 }}>{relPath}</span>
                  <span
                    onClick={(e) => closeTab(tab.path, e)}
                    style={{
                      width: 16, height: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 4,
                      marginLeft: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#3f3f46'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Code content */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {activeFile ? (
            <div style={{ display: 'flex', minHeight: '100%' }}>
              {/* Line numbers */}
              <div style={{
                padding: '12px 0',
                textAlign: 'right',
                color: '#555570',
                fontSize: 13,
                lineHeight: '20px',
                fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
                userSelect: 'none',
                minWidth: 48,
                paddingRight: 12,
                paddingLeft: 12,
                background: '#18181b',
                flexShrink: 0,
              }}>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* Code */}
              <pre style={{
                flex: 1,
                margin: 0,
                padding: '12px 16px',
                fontSize: 13,
                lineHeight: '20px',
                fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
                color: '#e4e4ef',
                background: '#18181b',
                overflow: 'visible',
                whiteSpace: 'pre',
                tabSize: 2,
              }}>
                <code ref={codeRef} style={{ display: 'block' }} />
              </pre>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#3f3f46', fontSize: 13,
            }}>
              {loading ? 'Loading...' : 'Select a file to view'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
