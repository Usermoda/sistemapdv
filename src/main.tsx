import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';
import { useTheme } from './stores/themeStore';
import './styles.css';

function Root() {
  const theme = useTheme((s) => s.theme);
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors theme={theme} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
