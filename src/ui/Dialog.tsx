import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Dialog.module.css'

export function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); opener.current?.focus() }
  }, [])
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className={styles.heading}><h2 id="dialog-title">{title}</h2><button type="button" className={styles.close} onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>
}
