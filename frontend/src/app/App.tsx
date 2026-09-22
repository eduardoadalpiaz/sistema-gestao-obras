import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ConstructionManagementProvider } from './context/construction-context';

export default function App() {
  return (
    <ConstructionManagementProvider>
      <RouterProvider router={router} />
    </ConstructionManagementProvider>
  );
}
