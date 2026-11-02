import { create } from 'zustand';

interface UiState {
  /** The text node currently open in the rich-text editor. */
  editingTextId: string | null;
  setEditingText: (id: string | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editingTextId: null,
  setEditingText: (editingTextId) => set({ editingTextId }),
}));
