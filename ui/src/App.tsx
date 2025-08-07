import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from '@/components/navbar';
import { AppSidebar } from '@/components/appSidebar';
import { Home } from '@/pages/Home';
import { Settings } from '@/pages/Settings';
import { Page1 } from '@/pages/Page1';
import { Page2 } from '@/pages/Page2';
import { MenuInsights } from '@/pages/MenuInsights';
import { ConsultationDemo } from '@/pages/ConsultationDemo';
import { Login } from '@/pages/Login';
import { PublicUpload } from '@/pages/PublicUpload';
import { Hero } from '@/components/Hero';
import { Header } from '@/components/Header';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"></div>;
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen bg-background">
        <Routes>
          {/* Main landing page - public */}
          <Route path="/" element={
            <div className="min-h-screen bg-background">
              <Header 
                onSignIn={() => window.location.href = '/login'}
                onGetStarted={() => window.location.href = '/upload'}
              />
              <Hero 
                onGetStarted={() => window.location.href = '/upload'}
                onLearnMore={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              />
            </div>
          } />
          
          {/* Authentication routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Public upload route */}
          <Route path="/upload" element={<PublicUpload />} />
          
          {/* Public routes */}
          <Route path="/menu-insights" element={<MenuInsights />} />
          <Route path="/consultation" element={<ConsultationDemo />} />
          
          {/* Protected dashboard routes with sidebar */}
          <Route path="/dashboard/*" element={
            <>
              <Navbar />
              {!user ? (
                <Navigate to="/login" replace />
              ) : (
                <div className="flex flex-1">
                  <AppSidebar />
                  <SidebarInset className="flex-1">
                    <main className="flex-1">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/page1" element={<Page1 />} />
                        <Route path="/page2" element={<Page2 />} />
                        <Route path="/menu-insights" element={<MenuInsights />} />
                        <Route path="/menu-insights/upload" element={<MenuInsights />} />
                        <Route path="/settings" element={<Settings />} />
                      </Routes>
                    </main>
                  </SidebarInset>
                </div>
              )}
            </>
          } />
        </Routes>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
        storageKey="volo-app-theme"
      >
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
