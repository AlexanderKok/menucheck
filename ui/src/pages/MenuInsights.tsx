import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MenuUpload } from '@/components/MenuUpload';
import { Hero } from '@/components/Hero';
import { Header } from '@/components/Header';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Target,
  ChefHat,
  ArrowUpRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/serverComm';


interface MenuAnalysis {
  id: string;
  fileName: string;
  uploadDate: string;
  status: 'completed' | 'processing' | 'failed';
  insights: {
    totalItems: number;
    avgPrice: number;
    priceRange: { min: number; max: number };
    categories: string[];
    recommendations: Array<{
      type: 'pricing' | 'placement' | 'description' | 'category';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      impact: string;
    }>;
    metrics: {
      profitabilityScore: number;
      readabilityScore: number;
      pricingOptimization: number;
      categoryBalance: number;
    };
  };
}

export function MenuInsights() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<MenuAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('overview');

  // Load user's menus when component mounts and user is available
  useEffect(() => {
    if (user) {
      loadUserMenus();
    }
  }, [user]);

  const loadUserMenus = async () => {
    try {
      setLoading(true);
      const result = await api.getUserMenus();
      
      if (result.success) {
        // Transform API data to match our interface
        const transformedAnalyses: MenuAnalysis[] = result.menus.map((menu: any) => ({
          id: menu.id,
          fileName: menu.originalFileName || menu.fileName,
          uploadDate: menu.createdAt,
          status: menu.status,
          insights: {
            totalItems: menu.totalItems || 0,
            avgPrice: parseFloat(menu.avgPrice || '0'),
            priceRange: { 
              min: parseFloat(menu.minPrice || '0'), 
              max: parseFloat(menu.maxPrice || '0') 
            },
            categories: menu.analysisData?.categories || [],
            recommendations: menu.analysisData?.recommendations || [],
            metrics: {
              profitabilityScore: menu.profitabilityScore || 0,
              readabilityScore: menu.readabilityScore || 0,
              pricingOptimization: menu.pricingOptimizationScore || 0,
              categoryBalance: menu.categoryBalanceScore || 0
            }
          }
        }));
        
        setAnalyses(transformedAnalyses);
      }
    } catch (error) {
      console.error('Error loading menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (files: File[]) => {
    // Files are handled by the MenuUpload component
    console.log('Files uploaded:', files);
    // Refresh the menu list after upload
    setTimeout(() => {
      loadUserMenus();
    }, 5000); // Wait a bit for processing
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // If user is not logged in, show public landing page
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          onSignIn={() => window.location.href = '/login'}
          onGetStarted={() => window.location.href = '/login'}
        />
        <Hero 
          onGetStarted={() => window.location.href = '/login'}
          onLearnMore={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-primary" />
            {t('menuInsights.title', 'Menu Insights Dashboard')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('menuInsights.subtitle', 'Analyze your menu performance and get actionable recommendations')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            {t('menuInsights.tabs.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="upload">
            {t('menuInsights.tabs.upload', 'Upload Menu')}
          </TabsTrigger>
          <TabsTrigger value="history">
            {t('menuInsights.tabs.history', 'Analysis History')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading menu analyses...</p>
            </div>
          ) : analyses.length > 0 ? (
            <>
              {/* Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    title: t('menuInsights.metrics.profitability', 'Profitability'),
                    value: analyses[0].insights.metrics.profitabilityScore,
                    icon: DollarSign,
                    suffix: '/100'
                  },
                  {
                    title: t('menuInsights.metrics.readability', 'Readability'),
                    value: analyses[0].insights.metrics.readabilityScore,
                    icon: FileText,
                    suffix: '/100'
                  },
                  {
                    title: t('menuInsights.metrics.pricing', 'Pricing'),
                    value: analyses[0].insights.metrics.pricingOptimization,
                    icon: Target,
                    suffix: '/100'
                  },
                  {
                    title: t('menuInsights.metrics.balance', 'Category Balance'),
                    value: analyses[0].insights.metrics.categoryBalance,
                    icon: BarChart3,
                    suffix: '/100'
                  }
                ].map((metric, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {metric.title}
                        </CardTitle>
                        <metric.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className={`text-2xl font-bold ${getScoreColor(metric.value)}`}>
                          {metric.value}{metric.suffix}
                        </div>
                      </div>
                      <Progress 
                        value={metric.value} 
                        className="mt-2"
                        color={getScoreBg(metric.value)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('menuInsights.stats.totalItems', 'Total Menu Items')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyses[0].insights.totalItems}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('menuInsights.stats.avgPrice', 'Average Price')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${analyses[0].insights.avgPrice}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('menuInsights.stats.priceRange', 'Price Range')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${analyses[0].insights.priceRange.min} - ${analyses[0].insights.priceRange.max}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('menuInsights.recommendations.title', 'Key Recommendations')}
                  </CardTitle>
                  <CardDescription>
                    {t('menuInsights.recommendations.description', 'Actionable insights to improve your menu performance')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analyses[0].insights.recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                              {rec.priority.toUpperCase()} PRIORITY
                            </Badge>
                            <Badge variant="secondary">{rec.type}</Badge>
                          </div>
                          <h4 className="font-semibold">{rec.title}</h4>
                          <p className="text-muted-foreground text-sm mt-1">{rec.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {rec.impact}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">
                  {t('menuInsights.noAnalyses.title', 'No Menu Analyses Yet')}
                </CardTitle>
                <CardDescription className="mb-4">
                  {t('menuInsights.noAnalyses.description', 'Upload your first menu to get started with AI-powered insights')}
                </CardDescription>
                <Button onClick={() => setActiveTab('upload')}>
                  {t('menuInsights.noAnalyses.uploadButton', 'Upload Your First Menu')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <MenuUpload onFileUpload={handleFileUpload} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('menuInsights.history.title', 'Analysis History')}</CardTitle>
              <CardDescription>
                {t('menuInsights.history.description', 'View all your previous menu analyses')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyses.map((analysis) => (
                  <div key={analysis.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{analysis.fileName}</h4>
                      <Badge 
                        variant={analysis.status === 'completed' ? 'default' : 'secondary'}
                      >
                        {analysis.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('menuInsights.history.uploadedOn', 'Uploaded on')} {new Date(analysis.uploadDate).toLocaleDateString()}
                    </p>
                    {analysis.status === 'completed' && (
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm">
                          {t('menuInsights.history.viewDetails', 'View Details')}
                        </Button>
                        <Button variant="outline" size="sm">
                          {t('menuInsights.history.downloadReport', 'Download Report')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}