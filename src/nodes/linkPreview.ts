import { create } from 'zustand';
import { fetchLinkPreview } from '../content/api';
import { useMapStore } from '../store/mapStore';

/** The link as an http(s) URL, or undefined for anything else (never a javascript: link). */
export function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** "https://www.example.com/a" → "example.com". */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Accepts "example.com/x" or a full URL, like the dev server does. */
export function normalizeLink(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return safeHref(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}

type Status = { loading: true } | { loading: false; error: string };

/** Edit mode: link nodes whose preview is being fetched, or failed to. */
export const useLinkStatus = create<Record<string, Status | undefined>>(() => ({}));

const setStatus = (id: string, status: Status | undefined) =>
  useLinkStatus.setState({ [id]: status });

/**
 * Sets a link node's URL and fetches its preview (title, icon, image or screenshot) through the
 * dev server. On failure the card keeps the URL and falls back to the domain.
 */
export function loadLinkPreview(id: string, input: string): boolean {
  const url = normalizeLink(input);
  if (!url) {
    setStatus(id, { loading: false, error: 'Enter a web address, like example.com' });
    return false;
  }
  void fetchInto(id, url);
  return true;
}

async function fetchInto(id: string, url: string) {
  const { updateNodeData } = useMapStore.getState();
  updateNodeData<'link'>(id, {
    url,
    title: '',
    description: '',
    siteName: '',
    image: undefined,
    favicon: undefined,
  });
  setStatus(id, { loading: true });
  try {
    const preview = await fetchLinkPreview(url);
    // Skip a stale answer if the link changed (or the node went away) meanwhile.
    const node = useMapStore.getState().nodes.find((n) => n.id === id);
    if (node?.type !== 'link' || node.data.url !== url) return;
    // The fetched details belong to the URL change: one undo step reverts both.
    const history = useMapStore.temporal.getState();
    history.pause();
    updateNodeData<'link'>(id, { ...preview, url });
    history.resume();
    setStatus(id, undefined);
  } catch (err) {
    setStatus(id, { loading: false, error: (err as Error).message });
  }
}
