import { type FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EDITABLE, fetchMap, reorderMaps, saveMap, snapshotUrl } from '../content/api';
import { useMapStore } from '../store/mapStore';
import { MAP_VERSION, slugify } from '../store/schema';
import { type SaveStatus, useUiStore } from '../store/uiStore';
import { useTheme } from '../ui/theme';
import styles from './CanvasPanel.module.css';
import { useCanvasIndex } from './canvasIndex';
import { beginCanvasSlide } from './canvasTransition';

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
};

/** A free slug for a new canvas title, e.g. "roadmap", then "roadmap-2". */
function uniqueSlug(title: string, taken: Set<string>) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Remembered per browser (a convenience; storage may be unavailable). */
const COLLAPSED_KEY = 'mubu.panelCollapsed';
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode or blocked storage: it just won't be remembered.
  }
}

/** The panel's heading. */
export const PANEL_TITLE = "Botao's canvas";

/**
 * Renames a canvas. The open one changes in the store (autosave writes it, live everywhere);
 * any other is read, retitled and saved straight away.
 */
async function renameCanvas(slug: string, title: string) {
  const store = useMapStore.getState();
  if (store.slug === slug) {
    store.setTitle(title);
    document.title = `${title} · Mubu`;
    return;
  }
  const doc = await fetchMap(slug);
  useCanvasIndex.getState().setMaps(await saveMap(slug, { ...doc, title }));
}

/**
 * Left panel listing every canvas, in order, as a snapshot of its last view (in the current theme)
 * and its title. The open canvas is ringed. In the editor it also shows the save status, can create
 * a canvas, and a double-click on a canvas's name renames it; snapshots are retaken after each save
 * (see useAutosave).
 */
export function CanvasPanel({ slug }: { slug: string | null }) {
  const maps = useCanvasIndex((s) => s.maps);
  const loaded = useCanvasIndex((s) => s.loaded);
  // The open canvas's title as it's being edited, before the index catches up.
  const liveTitle = useMapStore((s) => (s.slug === slug ? s.title : null));
  const theme = useTheme((s) => s.theme);
  const saveStatus = useUiStore((s) => s.saveStatus);
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Tucked away to the left, with a sliver still showing; the handle on its edge toggles it.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c);
      return !c;
    });
  };
  // Drag to reorder (edit mode): the canvas being dragged, and where it would land.
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ slug: string; after: boolean } | null>(null);

  /** Saves a new order (shown straight away); the first canvas is where visitors start. */
  const reorder = (slugs: string[]) => {
    const bySlug = new Map(maps.map((m) => [m.slug, m]));
    useCanvasIndex
      .getState()
      .setMaps(slugs.map((s) => bySlug.get(s)).filter((m) => m !== undefined));
    reorderMaps(slugs)
      .then(useCanvasIndex.getState().setMaps)
      .catch((err: Error) => {
        setError(err.message);
        void useCanvasIndex.getState().refresh();
      });
  };

  /** `moved` placed before or after `target`. */
  const moveTo = (moved: string, target: string, after: boolean) => {
    if (moved === target) return;
    const rest = maps.map((m) => m.slug).filter((s) => s !== moved);
    const at = rest.indexOf(target) + (after ? 1 : 0);
    rest.splice(at, 0, moved);
    if (rest.join() !== maps.map((m) => m.slug).join()) reorder(rest);
  };

  // The canvas whose name is being edited, and the draft.
  const [renaming, setRenaming] = useState<{ slug: string; title: string } | null>(null);

  const commitRename = () => {
    if (!renaming) return;
    const name = renaming.title.trim();
    const before = maps.find((m) => m.slug === renaming.slug);
    const current = renaming.slug === slug ? liveTitle : before?.title;
    setRenaming(null);
    if (!name || name === current) return;
    renameCanvas(renaming.slug, name).catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (!loaded) void useCanvasIndex.getState().refresh();
  }, [loaded]);

  const go = (target: string) => {
    if (target === slug) return;
    // Slide by position in the list: further down slides up, back up slides down.
    const from = maps.findIndex((m) => m.slug === slug);
    const to = maps.findIndex((m) => m.slug === target);
    if (from !== -1 && to !== -1) beginCanvasSlide(to > from ? 'up' : 'down');
    navigate(`/m/${target}`);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = newTitle.trim() || 'Untitled canvas';
    const target = uniqueSlug(name, new Set(maps.map((m) => m.slug)));
    try {
      useCanvasIndex
        .getState()
        .setMaps(
          await saveMap(target, { version: MAP_VERSION, title: name, nodes: [], edges: [] }),
        );
      setCreating(false);
      setNewTitle('');
      setError(null);
      go(target);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className={`${styles.dock} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.clip}>
        {/* Tucked away, the sliver is one big "show the panel" target; its contents rest. */}
        {collapsed && (
          <button
            type="button"
            className={styles.sliver}
            aria-label="Show canvases"
            tabIndex={-1}
            onClick={toggle}
          />
        )}
        <nav className={styles.panel} aria-label="Canvases" id="canvas-panel" inert={collapsed}>
          <div className={styles.header}>
            <h2 className={styles.heading}>{PANEL_TITLE}</h2>
            {EDITABLE && saveStatus && (
              // Shown while there's something unsaved; "All changes saved" is for screen readers only.
              <span
                className={`${styles.status} ${saveStatus === 'saved' ? styles.srOnly : ''}`}
                data-status={saveStatus}
                role="status"
              >
                {STATUS_LABEL[saveStatus]}
              </span>
            )}
          </div>
          <ol className={styles.list}>
            {maps.map((map) => {
              const current = map.slug === slug;
              const src = snapshotUrl(map, theme);
              const title = (current && liveTitle) || map.title;
              if (renaming?.slug === map.slug) {
                // Editing the name: the snapshot stays, the title becomes a field.
                return (
                  <li key={map.slug}>
                    <div className={styles.item} aria-current={current ? 'page' : undefined}>
                      <span className={styles.thumb}>
                        {src ? <img src={src} alt="" draggable={false} /> : null}
                      </span>
                      <input
                        className={styles.titleInput}
                        value={renaming.title}
                        aria-label="Canvas name"
                        // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked for it
                        autoFocus
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setRenaming({ slug: map.slug, title: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setRenaming(null);
                          }
                        }}
                      />
                    </div>
                  </li>
                );
              }
              const index = maps.indexOf(map);
              const dropClass =
                drop?.slug === map.slug && dragging !== map.slug
                  ? drop.after
                    ? styles.dropAfter
                    : styles.dropBefore
                  : '';
              return (
                <li
                  key={map.slug}
                  className={`${dropClass} ${dragging === map.slug ? styles.dragging : ''}`}
                  draggable={EDITABLE}
                  onDragStart={
                    EDITABLE
                      ? (e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', map.slug);
                          setDragging(map.slug);
                        }
                      : undefined
                  }
                  onDragOver={
                    EDITABLE && dragging
                      ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          const box = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > box.top + box.height / 2;
                          if (drop?.slug !== map.slug || drop.after !== after) {
                            setDrop({ slug: map.slug, after });
                          }
                        }
                      : undefined
                  }
                  onDrop={
                    EDITABLE && dragging
                      ? (e) => {
                          e.preventDefault();
                          if (drop) moveTo(dragging, drop.slug, drop.after);
                          setDragging(null);
                          setDrop(null);
                        }
                      : undefined
                  }
                  onDragEnd={
                    EDITABLE
                      ? () => {
                          setDragging(null);
                          setDrop(null);
                        }
                      : undefined
                  }
                >
                  <a
                    // The whole item is dragged (to reorder), not the link itself.
                    draggable={false}
                    aria-keyshortcuts={EDITABLE ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
                    onKeyDown={
                      EDITABLE
                        ? (e) => {
                            // Alt+↑/↓ moves the canvas up or down the list, for keyboard users.
                            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                            e.preventDefault();
                            const neighbor = maps[index + (e.key === 'ArrowUp' ? -1 : 1)];
                            if (neighbor) moveTo(map.slug, neighbor.slug, e.key === 'ArrowDown');
                          }
                        : undefined
                    }
                    href={`#/m/${map.slug}`}
                    className={styles.item}
                    aria-current={current ? 'page' : undefined}
                    onClick={(e) => {
                      // Plain clicks switch in place (with the slide); ⌘/Ctrl-click opens a new tab.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      go(map.slug);
                    }}
                  >
                    <span className={styles.thumb}>
                      {src ? (
                        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        <span className={styles.thumbEmpty} aria-hidden="true">
                          {title.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span
                      className={styles.title}
                      title={EDITABLE ? 'Double-click to rename' : undefined}
                      onDoubleClick={
                        EDITABLE
                          ? (e) => {
                              e.preventDefault();
                              setRenaming({ slug: map.slug, title });
                            }
                          : undefined
                      }
                    >
                      {title}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          {EDITABLE && (
            <div className={styles.footer}>
              {creating ? (
                <form className={styles.newForm} onSubmit={create}>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Canvas name"
                    aria-label="New canvas name"
                    // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked for it
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setCreating(false);
                    }}
                  />
                  <button type="submit" className={styles.newButton}>
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.newButton}
                  onClick={() => setCreating(true)}
                >
                  + New canvas
                </button>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}
        </nav>
      </div>
      <button
        type="button"
        className={styles.handle}
        aria-controls="canvas-panel"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show canvases' : 'Hide canvases'}
        title={collapsed ? 'Show canvases' : 'Hide canvases'}
        onClick={toggle}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d={collapsed ? 'M3.5 1.5 7 5l-3.5 3.5' : 'M6.5 1.5 3 5l3.5 3.5'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
