import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WorkspacePage from './pages/WorkspacePage';
import DashboardPage from './pages/DashboardPage';
import AuthPage from './pages/AuthPage';
import useAuthStore from './stores/useAuthStore';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[NEXUS] render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-background text-text flex items-center justify-center p-6">
        <div className="glass-panel w-full max-w-lg p-6 rounded-2xl">
          <h1 className="text-lg font-bold text-red-400 mb-2">Something broke while rendering</h1>
          <p className="text-sm text-text-muted mb-4">
            The page hit a JavaScript error. The details below are usually enough to fix it.
          </p>
          <pre className="text-[11px] font-mono bg-black/40 border border-border/40 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
            {String((this.state.error && this.state.error.stack) || this.state.error)}
          </pre>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-3 py-2 rounded-lg bg-primary/15 text-primary border border-primary/40 text-sm"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => { localStorage.clear(); window.location.href = '/'; }}
              className="px-3 py-2 rounded-lg bg-white/5 text-text-muted text-sm"
            >
              Reset and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/" replace />;
}

function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-text">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/workspace/:id" element={<PrivateRoute><WorkspacePage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

export default App;
