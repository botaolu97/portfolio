import type { WorkspaceFile } from '../files/types'
import styles from './EditorPlaceholder.module.css'

export default function EditorPlaceholder({ file }: { file: WorkspaceFile }) {
  return <section className={`${styles.canvas} ${file.kind === 'board' ? styles.board : styles.document}`} aria-label={file.kind === 'board' ? 'Mood board canvas' : 'Document canvas'} />
}
