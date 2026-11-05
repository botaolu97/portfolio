import type { NodeProps } from '@xyflow/react';
import { memo, useRef, useState } from 'react';
import { asset, EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import type { NodeDataOf } from '../store/schema';
import { domainOf, loadLinkPreview, safeHref, useLinkStatus } from './linkPreview';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

type LinkData = NodeDataOf<'link'>;

/** The site's icon, or its initial on a tile when it has none. */
function SiteIcon({ data, domain, large }: { data: LinkData; domain: string; large?: boolean }) {
  const className = large ? styles.linkFallbackIcon : styles.linkFavicon;
  return data.favicon ? (
    <img
      className={className}
      src={asset(data.favicon)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  ) : (
    <span className={`${className} ${styles.linkInitial}`} aria-hidden="true">
      {domain.charAt(0).toUpperCase()}
    </span>
  );
}

/** Image (Open Graph image or screenshot), then the domain, title and description. */
function LinkCard({ data, href }: { data: LinkData; href: string }) {
  const domain = domainOf(href);
  const title = data.title || data.siteName;
  // Nothing better than the address: just the icon and the domain.
  if (!data.image && !title) {
    return (
      <div className={styles.linkFallback}>
        <SiteIcon data={data} domain={domain} large />
        <span className={styles.linkFallbackDomain}>{domain}</span>
      </div>
    );
  }
  return (
    <>
      <div className={styles.linkImage}>
        {data.image ? (
          <img src={asset(data.image)} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : (
          <div className={styles.linkFallback}>
            <SiteIcon data={data} domain={domain} large />
          </div>
        )}
      </div>
      <div className={styles.linkBody}>
        <div className={styles.linkSite}>
          <SiteIcon data={data} domain={domain} />
          <span>{domain}</span>
        </div>
        <div className={styles.linkTitle}>{title || domain}</div>
        {data.description && <div className={styles.linkDescription}>{data.description}</div>}
      </div>
    </>
  );
}

/** Edit mode: the address field on the card. Enter fetches the preview, Esc cancels. */
function LinkForm({
  initial,
  autoFocus,
  error,
  onSubmit,
  onCancel,
}: {
  initial: string;
  autoFocus: boolean;
  error?: string;
  /** Returns false if the address isn't usable (the form stays open). */
  onSubmit: (url: string) => boolean;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  // Enter submits once; the blur that follows (or an unmount) must not submit again.
  const done = useRef(false);
  const submit = () => {
    if (done.current) return;
    if (!value.trim() || value.trim() === initial) {
      done.current = true;
      onCancel();
      return;
    }
    done.current = onSubmit(value);
  };
  return (
    <form
      className={`${styles.linkForm} nodrag`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className={styles.linkFormTitle}>Web page</span>
      <input
        value={value}
        // biome-ignore lint/a11y/noAutofocus: a new or double-clicked card is waiting for its link
        autoFocus={autoFocus}
        spellCheck={false}
        aria-label="Web page URL"
        placeholder="Paste a link, e.g. example.com"
        onFocus={(e) => {
          done.current = false;
          // Typing or pasting replaces the old address.
          e.currentTarget.select();
        }}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          done.current = true;
          onCancel();
        }}
        onBlur={submit}
      />
      <span className={error ? styles.linkError : styles.linkHint}>
        {error ?? 'Enter to show a preview'}
      </span>
    </form>
  );
}

/**
 * A web page preview. Visitors click the card to open the page in a new tab. In the editor a click
 * selects and drags as usual; the ↗ button opens the page and double-click changes the address.
 */
export const LinkNode = memo(function LinkNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'link' }>>) {
  const href = safeHref(data.url);
  const status = useLinkStatus((s) => s[id]);
  const [editing, setEditing] = useState(false);
  const chrome = <NodeChrome selected={selected} minWidth={160} minHeight={80} />;

  if (!EDITABLE) {
    return (
      <>
        {chrome}
        {href ? (
          <a
            className={`${styles.link} ${styles.lift}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            title={href}
          >
            <LinkCard data={data} href={href} />
          </a>
        ) : (
          <div className={styles.placeholder}>No link yet</div>
        )}
      </>
    );
  }

  const loading = status?.loading === true;
  const error = status && !status.loading ? status.error : undefined;
  const showForm = editing || !href;
  return (
    <>
      {chrome}
      <div
        className={styles.link}
        onDoubleClick={() => setEditing(true)}
        aria-busy={loading || undefined}
      >
        {showForm ? (
          <LinkForm
            initial={data.url}
            autoFocus={editing || selected}
            error={error}
            onSubmit={(url) => {
              const ok = loadLinkPreview(id, url);
              if (ok) setEditing(false);
              return ok;
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          href && <LinkCard data={data} href={href} />
        )}
        {loading && <div className={styles.linkLoading}>Fetching preview…</div>}
        {href && !showForm && (
          <a
            className={`${styles.linkOpen} nodrag`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in a new tab"
            aria-label="Open in a new tab"
          >
            ↗
          </a>
        )}
      </div>
    </>
  );
});
