import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { 
  ArrowRight, 
  Upload, 
  BarChart3, 
  ChefHat, 
  TrendingUp, 
  Globe,
  Star,
  Play,
  CheckCircle,
  Users,
  DollarSign,
  Award,
  Zap,
  Target,
  Eye,
  MessageSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LandingPageProps {
  onGetStarted?: () => void;
  onSignIn?: () => void;
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const { t } = useTranslation();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const features = [
    {
      icon: Upload,
      title: t('landing.features.upload.title', 'Easy Upload'),
      description: t('landing.features.upload.description', 'Simply drag and drop your menu PDFs or images'),
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: BarChart3,
      title: t('landing.features.analysis.title', 'Smart Analysis'),
      description: t('landing.features.analysis.description', 'AI-powered insights into your menu performance'),
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: TrendingUp,
      title: t('landing.features.optimization.title', 'Revenue Optimization'),
      description: t('landing.features.optimization.description', 'Actionable recommendations to boost revenue'),
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: Globe,
      title: t('landing.features.multilingual.title', 'Multi-language'),
      description: t('landing.features.multilingual.description', 'Support for multiple languages and cuisines'),
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const stats = [
    { 
      value: '10K+', 
      label: t('landing.stats.menusAnalyzed', 'Menus Analyzed'),
      icon: ChefHat
    },
    { 
      value: '25%', 
      label: t('landing.stats.avgIncrease', 'Avg Revenue Increase'),
      icon: TrendingUp
    },
    { 
      value: '500+', 
      label: t('landing.stats.restaurants', 'Restaurants Trust Us'),
      icon: Users
    },
    { 
      value: '98%', 
      label: t('landing.stats.satisfaction', 'Customer Satisfaction'),
      icon: Star
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Owner, Golden Dragon',
      quote: 'Menu Insights helped us increase our revenue by 35% in just 3 months. The AI recommendations were spot-on!',
      rating: 5,
      image: '👩‍🍳'
    },
    {
      name: 'Marco Rodriguez',
      role: 'Head Chef, Bella Vista',
      quote: 'The menu analysis revealed pricing opportunities we never knew existed. Highly recommended!',
      rating: 5,
      image: '👨‍🍳'
    },
    {
      name: 'Emily Johnson',
      role: 'Restaurant Manager, The Riverside',
      quote: 'Easy to use, powerful insights, and excellent customer support. Game-changing for our business.',
      rating: 5,
      image: '👩‍💼'
    }
  ];

  const benefits = [
    {
      icon: Target,
      title: 'Optimize Pricing',
      description: 'Data-driven pricing recommendations based on market analysis and customer behavior'
    },
    {
      icon: Eye,
      title: 'Improve Layout',
      description: 'Strategic item placement to increase visibility of high-margin dishes'
    },
    {
      icon: MessageSquare,
      title: 'Enhance Descriptions',
      description: 'Compelling menu descriptions that drive orders and increase average ticket size'
    },
    {
      icon: Zap,
      title: 'Boost Performance',
      description: 'Real-time analytics and recommendations to continuously improve results'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
      />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:50px_50px] [mask-image:radial-gradient(white,transparent_85%)]" />
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-pulse delay-2000" />
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center max-w-5xl mx-auto">
            {/* Badge */}
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
              <ChefHat className="h-4 w-4 mr-2" />
              {t('landing.badge', 'Powered by AI')}
            </Badge>
            
            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
                Transform Your Menu
              </span>
              <br />
              <span className="text-foreground">Into Revenue</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed max-w-3xl mx-auto">
              {t('landing.description', 'Upload your menu and get instant AI-powered insights to optimize pricing, improve item placement, and boost your restaurant\'s profitability by up to 35%.')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                onClick={onGetStarted}
                className="text-lg px-8 py-6 h-auto bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {t('landing.getStarted', 'Start Free Analysis')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setIsVideoPlaying(true)}
                className="text-lg px-8 py-6 h-auto border-2 hover:bg-primary/5 transition-all duration-300"
              >
                <Play className="mr-2 h-5 w-5" />
                {t('landing.watchDemo', 'Watch Demo')}
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="text-sm text-muted-foreground mb-8">
              ✅ No credit card required • ✅ 5-minute setup • ✅ 30-day money-back guarantee
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Powerful Features
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to optimize your restaurant menu and maximize revenue
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-center">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              How It <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get insights from your menu in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '1',
                title: 'Upload Your Menu',
                description: 'Drag and drop your menu PDF or image files. Our AI supports multiple formats and languages.',
                icon: Upload,
                color: 'from-blue-500 to-cyan-500'
              },
              {
                step: '2',
                title: 'AI Analysis',
                description: 'Our advanced AI analyzes pricing, layout, descriptions, and item performance against industry benchmarks.',
                icon: BarChart3,
                color: 'from-purple-500 to-pink-500'
              },
              {
                step: '3',
                title: 'Get Insights',
                description: 'Receive actionable recommendations with estimated revenue impact to optimize your menu.',
                icon: TrendingUp,
                color: 'from-green-500 to-emerald-500'
              }
            ].map((step, index) => (
              <div key={index} className="text-center relative">
                {/* Connector Line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-secondary/30 z-0" />
                )}
                
                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-br ${step.color} text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-lg`}>
                    {step.step}
                  </div>
                  <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center mx-auto mb-4 opacity-20`}>
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Why Choose <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Menu Insights</span>?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Our AI-powered platform helps restaurants increase revenue through data-driven menu optimization.
              </p>
              
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{benefit.title}</h3>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              {/* Placeholder for menu visualization */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-8 border border-primary/20">
                <div className="bg-white rounded-xl p-6 shadow-xl">
                  <h3 className="text-xl font-bold mb-4 text-center">Sample Menu Analysis</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Signature Pasta</span>
                      <Badge className="bg-green-100 text-green-800">+15% Revenue</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Premium Steaks</span>
                      <Badge className="bg-blue-100 text-blue-800">Optimize Placement</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="font-medium">Dessert Selection</span>
                      <Badge className="bg-orange-100 text-orange-800">Add Descriptions</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What Our <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Customers Say</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Join hundreds of restaurants that have transformed their menus
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="text-center">
                  <div className="text-4xl mb-4">{testimonial.image}</div>
                  <div className="flex justify-center mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-center mb-4">
                    "{testimonial.quote}"
                  </blockquote>
                  <div className="text-center">
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-secondary text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Optimize Your Menu?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Join hundreds of restaurants using AI to increase their revenue and improve customer satisfaction.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={onGetStarted}
              className="text-lg px-8 py-6 h-auto bg-white text-primary hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {t('landing.cta.button', 'Start Free Analysis')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={onSignIn}
              className="text-lg px-8 py-6 h-auto border-white text-white hover:bg-white/10 transition-all duration-300"
            >
              {t('landing.cta.signIn', 'Sign In')}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <ChefHat className="h-8 w-8 text-primary mr-2" />
              <span className="text-2xl font-bold">Menu Insights</span>
            </div>
            <p className="text-muted-foreground mb-4">
              Transform your restaurant menu into revenue with AI-powered insights
            </p>
            <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}