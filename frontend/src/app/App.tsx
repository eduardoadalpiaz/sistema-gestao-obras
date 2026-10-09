import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { ConstructionManagementProvider } from './context/construction-context';

// O Provider guarda os dados do sistema (obras, etapas, gastos...) e o RouterProvider troca
// as telas conforme a URL. Qualquer tela acessa os dados pelo hook useConstructionManagement().
export default function App() {
  return (
    <ConstructionManagementProvider>
      <RouterProvider router={router} />
      {/* avisos (toast): ficam aqui pra aparecer em qualquer tela, inclusive no login */}
      <Toaster
        position="top-right"
        expand
        richColors={false}
        closeButton
        toastOptions={{
          style: {
            background: '#1a2332',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />
    </ConstructionManagementProvider>
  );
}
