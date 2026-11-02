import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

export function Button({
  variant = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const classes = [styles.button, variant !== 'default' && styles[variant], className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={classes} {...props} />;
}
