
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Upload, BarChart3, ChefHat, TrendingUp, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HeroProps {
  onGetStarted?: () => void;
  onLearnMore?: () => void;
}

export function Hero({ onGetStarted, onLearnMore }: HeroProps) {
  const { t } = useTranslation();

  const features = [
    {
      icon: Upload,
      title: t('hero.features.upload.title', 'Easy Upload'),
      description: t('hero.features.upload.description', 'Simply drag and drop your menu PDFs or images')
    },
    {
      icon: BarChart3,
      title: t('hero.features.analysis.title', 'Smart Analysis'),
      description: t('hero.features.analysis.description', 'AI-powered insights into your menu performance')
    },
    {
      icon: TrendingUp,
      title: t('hero.features.optimization.title', 'Optimization Tips'),
      description: t('hero.features.optimization.description', 'Actionable recommendations to boost revenue')
    },
    {
      icon: Globe,
      title: t('hero.features.multilingual.title', 'Multi-language'),
      description: t('hero.features.multilingual.description', 'Support for multiple languages and cuisines')
    }
  ];

  const stats = [
    { 
      value: '10K+', 
      label: t('hero.stats.menusAnalyzed', 'Menus Analyzed') 
    },
    { 
      value: '25%', 
      label: t('hero.stats.avgIncrease', 'Avg Revenue Increase') 
    },
    { 
      value: '500+', 
      label: t('hero.stats.restaurants', 'Restaurants Trust Us') 
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <ChefHat className="h-3 w-3 mr-1" />
            {t('hero.badge', 'Powered by AI')}
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-6">
            {t('hero.title', 'Transform Your Restaurant Menu Into Revenue')}
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            {t('hero.description', 'Upload your menu and get instant AI-powered insights to optimize pricing, improve item placement, and boost your restaurant\'s profitability.')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              onClick={onGetStarted}
              className="text-lg px-8 py-6"
            >
              {t('hero.getStarted', 'Get Started Free')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={onLearnMore}
              className="text-lg px-8 py-6"
            >
              {t('hero.learnMore', 'Learn More')}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-16">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              {t('hero.howItWorks.title', 'How It Works')}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('hero.howItWorks.description', 'Get insights from your menu in three simple steps')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: t('hero.steps.upload.title', 'Upload Your Menu'),
                description: t('hero.steps.upload.description', 'Drag and drop your menu PDF or image files')
              },
              {
                step: '2',
                title: t('hero.steps.analyze.title', 'AI Analysis'),
                description: t('hero.steps.analyze.description', 'Our AI analyzes pricing, layout, and item performance')
              },
              {
                step: '3',
                title: t('hero.steps.optimize.title', 'Get Insights'),
                description: t('hero.steps.optimize.description', 'Receive actionable recommendations to increase revenue')
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t('hero.cta.title', 'Ready to Optimize Your Menu?')}
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            {t('hero.cta.description', 'Join hundreds of restaurants using AI to increase their revenue and improve customer satisfaction.')}
          </p>
          <Button 
            size="lg" 
            onClick={onGetStarted}
            className="text-lg px-8 py-6"
          >
            {t('hero.cta.button', 'Start Free Analysis')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}