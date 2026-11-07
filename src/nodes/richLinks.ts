import { asset } from '../content/api';

/** Only icons Mubu saved itself (content/assets/<hash>.<ext>) are shown. */
const SAVED_ICON = /^content\/assets\/[\w.-]+$/;

/** The CSS that shows a link's saved page icon before its text (see `.rich a[data-favicon]`). */
export function faviconStyle(favicon: string): string | undefined {
  return SAVED_ICON.test(favicon) ? `--_favicon: url("${asset(favicon)}")` : undefined;
}

const cache = new Map<string, string>();

/**
 * Rich text HTML with each previewed link's icon pointing at this deploy's copy of it. Links store
 * the icon as a content path (`data-favicon`); where the site is served from differs between the
 * editor and the published site, so the style is filled in when the text is shown.
 */
export function withLinkIcons(html: string): string {
  if (!html.includes('data-favicon')) return html;
  const hit = cache.get(html);
  if (hit !== undefined) return hit;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const a of template.content.querySelectorAll<HTMLAnchorElement>('a[data-favicon]')) {
    const style = faviconStyle(a.dataset.favicon ?? '');
    if (style) a.setAttribute('style', style);
    else a.removeAttribute('style');
  }
  const out = template.innerHTML;
  if (cache.size > 200) cache.clear();
  cache.set(html, out);
  return out;
}
