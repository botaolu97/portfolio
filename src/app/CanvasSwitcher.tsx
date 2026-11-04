import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { EDITABLE, fetchMapIndex, saveMap } from '../content/api';
import { MAP_VERSION, type MapIndexEntry, slugify } from '../store/schema';
import { type SaveStatus, useUiStore } from '../store/uiStore';
import styles from './CanvasSwitcher.module.css';
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

/**
 * Bottom-left control showing the current canvas; opens a menu of all canvases. In edit mode
 * the menu can also create a canvas. Canvases are deleted with `npm run delete-canvas`.
 */
export function CanvasSwitcher({ slug, title }: { slug: string | null; title: string }) {
  const [open, setOpen] = useState(false);
  const [maps, setMaps] = useState<MapIndexEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saveStatus = useUiStore((s) => s.saveStatus);
  // The full-screen reader shows only the theme switch: fade out with the zoom in, back in with the zoom out.
  const hidden = useUiStore((s) => s.readerOpen);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  // Refresh the list whenever the menu opens, so new canvases show up.
  useEffect(() => {
    if (!open) return;
    fetchMapIndex().then(setMaps);
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  // Move focus into the menu once it has items.
  useEffect(() => {
    if (open && !creating)
      menu.current
        ?.querySelector<HTMLElement>('[aria-checked="true"], [role^="menuitem"]')
        ?.focus();
  }, [open, creating, maps]);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setNewTitle('');
    setError(null);
  };

  const go = (target: string) => {
    close();
    if (target === slug) return;
    // Slide by position in the canvas order: further down the list slides up, back slides down.
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
      await saveMap(target, { version: MAP_VERSION, title: name, nodes: [], edges: [] });
      go(target);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      root.current?.querySelector('button')?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={root}
      className={`${styles.switcher} ${open ? styles.open : ''} ${hidden ? styles.hidden : ''}`}
      inert={hidden}
    >
      {open && (
        <div
          ref={menu}
          className={styles.menu}
          role="menu"
          aria-label="Canvases"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          <p className={styles.heading}>Canvases</p>
          {maps.map((map) => (
            <button
              key={map.slug}
              type="button"
              role="menuitemradio"
              aria-checked={map.slug === slug}
              className={styles.item}
              onClick={() => go(map.slug)}
            >
              <span className={styles.check} aria-hidden="true">
                {map.slug === slug ? '✓' : ''}
              </span>
              <span className={styles.name}>
                {map.slug === slug ? title || map.title : map.title}
              </span>
            </button>
          ))}
          {EDITABLE && (
            <>
              <div className={styles.divider} />
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
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setCreating(false);
                      }
                    }}
                  />
                  <button type="submit" className={`${styles.item} ${styles.newItem}`}>
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.item} ${styles.newItem}`}
                  onClick={() => setCreating(true)}
                >
                  <span className={styles.check} aria-hidden="true">
                    +
                  </span>
                  New canvas
                </button>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Canvas: ${title}. Switch canvas`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {saveStatus && saveStatus !== 'saved' && (
          <span className={styles.status} data-status={saveStatus} aria-hidden="true" />
        )}
        <span className={styles.name}>{title}</span>
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path
            d="M3 7.5 6 4.5l3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {saveStatus && (
        <span className={styles.srOnly} role="status">
          {STATUS_LABEL[saveStatus]}
        </span>
      )}
    </div>
  );
}
