import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EDITABLE, fetchMapIndex } from '../content/api';
import { CanvasSwitcher } from './CanvasSwitcher';
import styles from './MapPage.module.css';

/**
 * The root address opens the first canvas in the panel's order straight away (drag canvases in
 * the editor's panel to choose which).
 */
export function Home() {
  const [, navigate] = useLocation();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    document.title = 'Mubu';
    fetchMapIndex().then((maps) => {
      const start = maps[0];
      if (start) navigate(`/m/${start.slug}`, { replace: true });
      else setEmpty(true);
    });
  }, [navigate]);

  if (!empty) return <div className={styles.message}>Loading…</div>;
  return (
    <div className={styles.message}>
      <p>{EDITABLE ? 'No canvases yet. Create one from the menu.' : 'Nothing published yet.'}</p>
      <CanvasSwitcher slug={null} title="Canvases" />
    </div>
  );
}
