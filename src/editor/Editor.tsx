import { ContextMenu } from './ContextMenu';
import styles from './Editor.module.css';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { StartViewControl } from './StartViewControl';
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
      <Palette />
      <StartViewControl />
      <Inspector onError={onError} />
      <ContextMenu />
      {message && (
        <div className={styles.toast} role="alert">
          {message}
        </div>
      )}
    </>
  );
}
