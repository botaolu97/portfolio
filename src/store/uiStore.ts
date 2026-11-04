import { create } from 'zustand';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

interface UiState {
  /** The text node currently open in the rich-text editor. */
  editingTextId: string | null;
  /** Autosave state of the open canvas (edit mode only; null in view mode). */
  saveStatus: SaveStatus | null;
  /** Open right-click menu (edit mode). */
  contextMenu: { nodeId: string; x: number; y: number } | null;
  /** Text node or note open in the full-screen reader. */
  readerNodeId: string | null;
  /** False once the reader starts zooming back, so the canvas UI can fade in during the zoom. */
  readerOpen: boolean;
  setEditingText: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus | null) => void;
  setContextMenu: (menu: UiState['contextMenu']) => void;
  setReader: (id: string | null) => void;
  setReaderOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editingTextId: null,
  saveStatus: null,
  contextMenu: null,
  readerNodeId: null,
  readerOpen: false,
  setEditingText: (editingTextId) => set({ editingTextId }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setReader: (readerNodeId) => set({ readerNodeId, readerOpen: readerNodeId !== null }),
  setReaderOpen: (readerOpen) => set({ readerOpen }),
}));
