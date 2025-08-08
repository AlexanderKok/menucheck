import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Loader2, ChefHat, MapPin, Phone, Mail } from 'lucide-react';
import { requestPublicReport } from '@/lib/serverComm';

const restaurantTypes = [
  'fine_dining',
  'casual_dining',
  'fast_casual',
  'fast_food',
  'cafe',
  'bar',
  'food_truck',
  'bakery',
  'pizzeria',
  'other'
];

const cuisineTypes = [
  'italian',
  'french',
  'american',
  'mexican',
  'chinese',
  'japanese',
  'indian',
  'mediterranean',
  'thai',
  'vietnamese',
  'greek',
  'spanish',
  'german',
  'british',
  'korean',
  'fusion',
  'vegetarian',
  'vegan',
  'seafood',
  'steakhouse',
  'bbq',
  'other'
];

export function RestaurantDetails() {
  const { t } = useTranslation();
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    restaurantName: '',
    address: '',
    city: '',
    country: '',
    restaurantType: '',
    cuisines: [] as string[],
    phoneNumber: '',
    description: ''
  });

  useEffect(() => {
    if (!uploadId) {
      navigate('/public-upload');
    }
  }, [uploadId, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCuisineToggle = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter(c => c !== cuisine)
        : [...prev.cuisines, cuisine]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadId) {
      return;
    }

    if (!formData.restaurantName.trim()) {
      setResult({
        success: false,
        message: t('restaurantDetails.validation.nameRequired', 'Restaurant name is required')
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await requestPublicReport({
        uploadId,
        restaurantName: formData.restaurantName,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        restaurantType: formData.restaurantType,
        cuisines: formData.cuisines,
        phoneNumber: formData.phoneNumber,
        description: formData.description
      });

      if (response.success) {
        setResult({
          success: true,
          message: t('restaurantDetails.success', 'Restaurant details saved successfully! Your analysis report is being generated.')
        });
      } else {
        setResult({
          success: false,
          message: response.message || t('restaurantDetails.error', 'Failed to save restaurant details')
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: t('restaurantDetails.error', 'Failed to save restaurant details')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!uploadId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Header 
        onSignIn={() => navigate('/login')}
        onGetStarted={() => navigate('/upload')}
      />
      
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <ChefHat className="h-10 w-10 text-primary" />
            <span className="text-2xl font-bold">
              {t('restaurantDetails.brand', 'Menu Insights')}
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {t('restaurantDetails.title', 'Restaurant Details')}
          </h1>
          <p className="text-muted-foreground">
            {t('restaurantDetails.subtitle', 'Please provide your restaurant information to complete the analysis and receive your free report.')}
          </p>
        </div>

        {/* Success State */}
        {result?.success ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-green-700">
                  {t('restaurantDetails.reportRequested', 'Report Requested Successfully!')}
                </h2>
                <p className="text-muted-foreground">
                  {result.message}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>{t('restaurantDetails.nextSteps', 'What happens next?')}</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• {t('restaurantDetails.step1', 'Your menu is being analyzed by our AI')}</li>
                    <li>• {t('restaurantDetails.step2', 'You\'ll receive insights on pricing, profitability, and optimization')}</li>
                    <li>• {t('restaurantDetails.step3', 'The complete report will be ready in 5-10 minutes')}</li>
                  </ul>
                </div>
                <div className="flex gap-3 justify-center mt-6">
                  <Button onClick={() => navigate('/public-upload')} variant="outline">
                    {t('restaurantDetails.uploadAnother', 'Upload Another Menu')}
                  </Button>
                  <Button onClick={() => navigate('/login')}>
                    {t('restaurantDetails.createAccount', 'Create Account for More Features')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Form */
          <Card>
            <CardHeader>
              <CardTitle>
                {t('restaurantDetails.formTitle', 'Restaurant Information')}
              </CardTitle>
              <CardDescription>
                {t('restaurantDetails.formDescription', 'Help us provide more accurate insights by telling us about your restaurant.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Restaurant Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4" />
                    {t('restaurantDetails.name.label', 'Restaurant Name')} *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.restaurantName}
                    onChange={(e) => handleInputChange('restaurantName', e.target.value)}
                    placeholder={t('restaurantDetails.name.placeholder', 'Enter your restaurant name')}
                    required
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t('restaurantDetails.address.label', 'Address')}
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder={t('restaurantDetails.address.placeholder', 'Street address')}
                  />
                </div>

                {/* City & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      {t('restaurantDetails.city.label', 'City')}
                    </Label>
                    <Input
                      id="city"
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder={t('restaurantDetails.city.placeholder', 'City')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">
                      {t('restaurantDetails.country.label', 'Country')}
                    </Label>
                    <Input
                      id="country"
                      type="text"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder={t('restaurantDetails.country.placeholder', 'Country')}
                    />
                  </div>
                </div>

                {/* Restaurant Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">
                    {t('restaurantDetails.type.label', 'Restaurant Type')}
                  </Label>
                  <Select value={formData.restaurantType} onValueChange={(value) => handleInputChange('restaurantType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('restaurantDetails.type.placeholder', 'Select restaurant type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurantTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`restaurantTypes.${type}`, type.replace('_', ' '))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cuisines */}
                <div className="space-y-2">
                  <Label>
                    {t('restaurantDetails.cuisines.label', 'Cuisine Types')}
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {cuisineTypes.map((cuisine) => (
                      <Button
                        key={cuisine}
                        type="button"
                        variant={formData.cuisines.includes(cuisine) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCuisineToggle(cuisine)}
                        className="text-xs"
                      >
                        {t(`cuisineTypes.${cuisine}`, cuisine)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t('restaurantDetails.phone.label', 'Phone Number')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    placeholder={t('restaurantDetails.phone.placeholder', 'Phone number')}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    {t('restaurantDetails.description.label', 'Description')}
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={t('restaurantDetails.description.placeholder', 'Tell us about your restaurant (optional)')}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Error Message */}
                {result && !result.success && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {result.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('restaurantDetails.submitting', 'Requesting Report...')}
                    </>
                  ) : (
                    t('restaurantDetails.submit', 'Request Free Analysis Report')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}