import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MainMapPage from './MainMapPage';
import { FullPageLoader } from '@/components/ui/loading-spinner';

const Index = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <MainMapPage />;
};

export default Index;

