import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/login-form';
import { Header } from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';

export function Login() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Header 
        onSignIn={() => {}} // Already on login page
        onGetStarted={() => navigate('/upload')}
        showAuth={false}
      />
      
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <ChefHat className="h-12 w-12 text-primary" />
              <span className="text-3xl font-bold">
                {t('login.brand', 'Menu Insights')}
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {t('login.title', 'Welcome Back')}
            </h1>
            <p className="text-muted-foreground">
              {t('login.subtitle', 'Sign in to access your menu analysis dashboard')}
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Navigation Links */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t('login.noAccount', "Don't have an account?")}{' '}
              <button 
                onClick={() => navigate('/upload')}
                className="text-primary hover:underline font-medium"
              >
                {t('login.tryFree', 'Try it free first')}
              </button>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <button 
                onClick={() => navigate('/')}
                className="text-primary hover:underline"
              >
                {t('login.backToHome', 'Back to home')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}