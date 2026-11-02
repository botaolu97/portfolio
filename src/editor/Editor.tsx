import styles from './Editor.module.css';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { Toolbar } from './Toolbar';
import { useAutosave } from './useAutosave';

/** Everything edit-only around the canvas. Lazy-loaded, and absent from the published build. */
export default function Editor({
  error,
  onError,
}: {
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const save = useAutosave();
  const message = error ?? save.error;
  return (
    <>
      <Toolbar status={save.status} onError={onError} />
      <Palette />
      <Inspector onError={onError} />
      {message && (
        <div className={styles.toast} role="alert">
          {message}
        </div>
      )}
    </>
  );
}
