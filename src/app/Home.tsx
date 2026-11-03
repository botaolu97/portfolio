import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { EDITABLE, fetchMapIndex } from '../content/api';
import { CanvasSwitcher } from './CanvasSwitcher';
import styles from './MapPage.module.css';

/** Where a visit to the site root starts: the welcome canvas if there is one, else the first. */
const START_SLUG = 'welcome';

/** The root address opens a canvas straight away; the switcher moves between them. */
export function Home() {
  const [, navigate] = useLocation();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    document.title = 'Mubu';
    fetchMapIndex().then((maps) => {
      const start = maps.find((m) => m.slug === START_SLUG) ?? maps[0];
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
