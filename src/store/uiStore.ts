import { create } from 'zustand';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

interface UiState {
  /** The text node currently open in the rich-text editor. */
  editingTextId: string | null;
  /** Autosave state of the open canvas (edit mode only; null in view mode). */
  saveStatus: SaveStatus | null;
  /** Open right-click menu (edit mode). */
  contextMenu: { nodeId: string; x: number; y: number } | null;
  setEditingText: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus | null) => void;
  setContextMenu: (menu: UiState['contextMenu']) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editingTextId: null,
  saveStatus: null,
  contextMenu: null,
  setEditingText: (editingTextId) => set({ editingTextId }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
}));
