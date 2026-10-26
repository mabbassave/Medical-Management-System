import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1F2937',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '0.85rem',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: {
              primary: '#396EF4',
              secondary: '#171B1A',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#171B1A',
            },
          },
        }}
      />
      <AppRoutes />
    </BrowserRouter>
  );
}
