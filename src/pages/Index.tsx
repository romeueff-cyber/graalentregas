import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MainMapPage from './MainMapPage';
import { FullPageLoader } from '@/components/ui/loading-spinner';

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return null;
  }

  return <MainMapPage />;
};

export default Index;
