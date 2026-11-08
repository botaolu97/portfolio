import styles from './Spinner.module.css';

/**
 * A circling ring, centered over its (positioned) parent, while an image or video loads. Hidden
 * from screen readers: the media's own alt text or label says what's there.
 */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}
