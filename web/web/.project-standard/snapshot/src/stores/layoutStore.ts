import { create } from "zustand";

interface LayoutState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen })
}));
