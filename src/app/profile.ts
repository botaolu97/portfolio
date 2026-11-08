import { create } from 'zustand';
import { fetchProfile, saveProfile } from '../content/api';
import type { Profile } from '../store/schema';

/** Shown until content/profile.json has loaded (and if it's missing). */
const DEFAULT_PROFILE: Profile = { name: 'Botao', intro: 'Senior product designer at MathWorks' };

interface ProfileState extends Profile {
  loaded: boolean;
  load: () => Promise<void>;
  /** Edit mode: shows the change at once and saves it to content/profile.json. */
  update: (patch: Partial<Profile>) => Promise<void>;
}

/** The owner's name and intro at the top of the canvas panel, kept as content like the maps. */
export const useProfile = create<ProfileState>()((set, get) => ({
  ...DEFAULT_PROFILE,
  loaded: false,
  load: async () => {
    const saved = await fetchProfile();
    set({ ...(saved ?? DEFAULT_PROFILE), loaded: true });
  },
  update: async (patch) => {
    const before = { name: get().name, intro: get().intro };
    const next = { ...before, ...patch };
    set(next);
    try {
      set(await saveProfile(next));
    } catch (err) {
      set(before);
      throw err;
    }
  },
}));
