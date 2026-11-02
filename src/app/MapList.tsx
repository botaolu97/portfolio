import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { deleteMap, EDITABLE, fetchMapIndex, saveMap } from '../content/api';
import { MAP_VERSION, type MapIndexEntry, slugify } from '../store/schema';
import { Button } from '../ui/Button';
import styles from './MapList.module.css';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function MapList() {
  const [maps, setMaps] = useState<MapIndexEntry[] | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = 'Mubu';
    fetchMapIndex().then(setMaps);
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim() || 'Untitled map';
    const taken = new Set(maps?.map((m) => m.slug));
    let slug = slugify(name);
    for (let i = 2; taken.has(slug); i++) slug = `${slugify(name)}-${i}`;
    try {
      await saveMap(slug, { version: MAP_VERSION, title: name, nodes: [], edges: [] });
      navigate(`/m/${slug}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (map: MapIndexEntry) => {
    if (!window.confirm(`Delete "${map.title}"? Uploaded files stay in public/content.`)) return;
    try {
      setMaps(await deleteMap(map.slug));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.brand}>Mubu</h1>
          <p className={styles.tagline}>Maps, sketches and live front-end demos.</p>
        </div>
        {EDITABLE && (
          <form className={styles.create} onSubmit={create}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New map title"
              aria-label="New map title"
            />
            <Button type="submit" variant="primary">
              New map
            </Button>
          </form>
        )}
      </header>
      {error && <p className={styles.error}>{error}</p>}
      {maps === null ? null : maps.length === 0 ? (
        <div className={styles.empty}>
          {EDITABLE ? 'No maps yet. Create one above.' : 'Nothing published yet.'}
        </div>
      ) : (
        <ul className={styles.grid}>
          {maps.map((map) => (
            <li key={map.slug}>
              <Link href={`/m/${map.slug}`} className={styles.card}>
                <span className={styles.cardTitle}>{map.title}</span>
                <span className={styles.cardMeta}>
                  Updated {dateFormat.format(new Date(map.updatedAt))}
                </span>
                {EDITABLE && (
                  <Button
                    variant="danger"
                    className={styles.delete}
                    onClick={(e) => {
                      e.preventDefault();
                      remove(map);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
