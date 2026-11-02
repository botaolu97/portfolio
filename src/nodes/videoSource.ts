export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; id: string; embed: string; thumbnail: string }
  | { kind: 'vimeo'; id: string; embed: string }
  | { kind: 'none' };

export function parseVideoSource(src: string): VideoSource {
  if (!src) return { kind: 'none' };
  let url: URL | null = null;
  try {
    url = new URL(src);
  } catch {
    return { kind: 'file', src };
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let youtubeId: string | null = null;
  if (host === 'youtu.be') youtubeId = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtubeId =
      url.searchParams.get('v') ??
      url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,}$/.test(youtubeId)) {
    return {
      kind: 'youtube',
      id: youtubeId,
      embed: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`,
      thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  const vimeoId = host.endsWith('vimeo.com') ? url.pathname.match(/\/(\d+)/)?.[1] : undefined;
  if (vimeoId) {
    return {
      kind: 'vimeo',
      id: vimeoId,
      embed: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
    };
  }
  return { kind: 'file', src };
}
