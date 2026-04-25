import { create } from 'zustand';

interface AppState {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    currentUser: {
        id: string;
        email: string;
        full_name: string;
        role: 'admin' | 'client';
        kyc_status: string;
    } | null;
    setCurrentUser: (user: AppState['currentUser']) => void;
}

export const useAppStore = create<AppState>((set) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    currentUser: {
        id: 'admin-001',
        email: 'admin@obbo.com',
        full_name: 'Juan Dela Cruz',
        role: 'admin',
        kyc_status: 'verified',
    },
    setCurrentUser: (user) => set({ currentUser: user }),
}));
