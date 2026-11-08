import { create } from 'zustand';
import { fetchMapIndex } from '../content/api';
import type { MapIndexEntry } from '../store/schema';

interface CanvasIndex {
  maps: MapIndexEntry[];
  loaded: boolean;
  /** Reads content/maps/index.json again. */
  refresh: () => Promise<MapIndexEntry[]>;
  /** The editor's save and snapshot requests answer with the new index: use it straight away. */
  setMaps: (maps: MapIndexEntry[]) => void;
}

/** All canvases, in order, for the canvas panel (titles and snapshot times). */
export const useCanvasIndex = create<CanvasIndex>()((set) => ({
  maps: [],
  loaded: false,
  refresh: async () => {
    const maps = await fetchMapIndex();
    set({ maps, loaded: true });
    return maps;
  },
  setMaps: (maps) => set({ maps, loaded: true }),
}));
