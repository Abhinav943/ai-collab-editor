import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authService.login({ email, password });
          const { user, token } = res.data.data;
          localStorage.setItem('token', token);
          set({ user, token, isLoading: false });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.error?.message || 'Login failed';
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authService.register({ username, email, password });
          const { user, token } = res.data.data;
          localStorage.setItem('token', token);
          set({ user, token, isLoading: false });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.error?.message || 'Registration failed';
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
      },

      setError: (error) => set({ error }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('auth:invalid', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth-store');
    useAuthStore.setState({ user: null, token: null, error: 'Your session expired. Please sign in again.' });
  });
}

export default useAuthStore;
