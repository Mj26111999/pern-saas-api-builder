import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';

// Store
import { store } from './store';

// Components
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import DatabaseConnections from './components/DatabaseConnections/DatabaseConnections';
import APIEndpoints from './components/APIEndpoints/APIEndpoints';
import CodeGeneration from './components/CodeGeneration/CodeGeneration';
import Analytics from './components/Analytics/Analytics';
import Settings from './components/Settings/Settings';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ErrorFallback from './components/Common/ErrorFallback';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Utils
import { lightTheme, darkTheme } from './utils/theme';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Main App Component
const AppContent = () => {
  const { isAuthenticated, tenant, initializeAuth } = useAuth();
  const [darkMode, setDarkMode] = React.useState(
    localStorage.getItem('darkMode') === 'true'
  );
  
  // Initialize socket connection for authenticated users
  useSocket(isAuthenticated ? tenant?.id : null, tenant?.api_key);
  
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);
  
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  const theme = React.useMemo(
    () => createTheme(darkMode ? darkTheme : lightTheme),
    [darkMode]
  );
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HelmetProvider>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  isAuthenticated ? 
                    <Navigate to="/dashboard" replace /> : 
                    <Login />
                } 
              />
              <Route 
                path="/register" 
                element={
                  isAuthenticated ? 
                    <Navigate to="/dashboard" replace /> : 
                    <Register />
                } 
              />
              
              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/databases" element={<DatabaseConnections />} />
                        <Route path="/endpoints" element={<APIEndpoints />} />
                        <Route path="/generate" element={<CodeGeneration />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </Box>
        
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: darkMode ? '#333' : '#fff',
              color: darkMode ? '#fff' : '#333',
            },
            success: {
              iconTheme: {
                primary: theme.palette.success.main,
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: theme.palette.error.main,
                secondary: '#fff',
              },
            },
          }}
        />
      </HelmetProvider>
    </ThemeProvider>
  );
};

// Error Boundary Wrapper
const App = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Application Error:', error, errorInfo);
        // Here you could send error to monitoring service
      }}
    >
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;