import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { ChefHat, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { ModeToggle } from './mode-toggle';

import { cn } from '@/lib/utils';

interface HeaderProps {
  onSignIn?: () => void;
  onGetStarted?: () => void;
  showAuth?: boolean;
}

export function Header({ onSignIn, onGetStarted, showAuth = true }: HeaderProps) {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    {
      title: t('header.nav.features', 'Features'),
      href: '#features',
      description: t('header.nav.featuresDesc', 'Discover what makes our menu analysis powerful')
    },
    {
      title: t('header.nav.pricing', 'Pricing'),
      href: '#pricing',
      description: t('header.nav.pricingDesc', 'Simple, transparent pricing for restaurants of all sizes')
    },
    {
      title: t('header.nav.demo', 'Demo'),
      href: '/consultation',
      description: t('header.nav.demoDesc', 'See our consultation process in action')
    },
    {
      title: t('header.nav.about', 'About'),
      href: '#about',
      description: t('header.nav.aboutDesc', 'Learn more about our mission and team')
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <ChefHat className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">
              {t('header.brand', 'Menu Insights')}
            </span>
          </div>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              {navigation.map((item) => (
                <NavigationMenuItem key={item.title}>
                  {item.href.startsWith('#') ? (
                    <NavigationMenuLink
                      href={item.href}
                      className={cn(
                        "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                      )}
                    >
                      {item.title}
                    </NavigationMenuLink>
                  ) : (
                    <>
                      <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="w-[400px] p-4">
                          <NavigationMenuLink
                            href={item.href}
                            className="block space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                          >
                            <div className="text-sm font-medium leading-none">{item.title}</div>
                            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </NavigationMenuLink>
                        </div>
                      </NavigationMenuContent>
                    </>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side controls */}
          <div className="flex items-center space-x-2">
            <LanguageToggle />
            <ModeToggle />
            
            {showAuth && (
              <div className="hidden sm:flex items-center space-x-2">
                <Button variant="ghost" onClick={onSignIn}>
                  {t('header.signIn', 'Sign In')}
                </Button>
                <Button onClick={onGetStarted}>
                  {t('header.getStarted', 'Get Started')}
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div className="space-y-1 pb-4 pt-2">
              {navigation.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.title}
                </a>
              ))}
              
              {showAuth && (
                <div className="pt-4 space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      onSignIn?.();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {t('header.signIn', 'Sign In')}
                  </Button>
                  <Button 
                    className="w-full"
                    onClick={() => {
                      onGetStarted?.();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {t('header.getStarted', 'Get Started')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}