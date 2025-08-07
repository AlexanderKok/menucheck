import { useState } from 'react';
import { Link, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/serverComm';

interface UrlUploadData {
  url: string;
  restaurant: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    restaurantType?: string;
    cuisines?: string[];
    phoneNumber?: string;
    description?: string;
  };
}

interface UrlUploadProps {
  onUrlUpload?: (data: UrlUploadData) => void;
  isPublicMode?: boolean;
  disabled?: boolean;
}

interface UploadJob {
  id: string;
  url: string;
  restaurantName: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

const restaurantTypes = [
  { value: 'casual-dining', label: 'Casual Dining' },
  { value: 'fine-dining', label: 'Fine Dining' },
  { value: 'fast-casual', label: 'Fast Casual' },
  { value: 'qsr', label: 'QSR (Quick Service)' },
  { value: 'cafe', label: 'Café' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'food-truck', label: 'Food Truck' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'bar-pub', label: 'Bar/Pub' },
];

const cuisineTypes = [
  'American', 'Italian', 'Chinese', 'Japanese', 'Mexican', 'Indian', 'French', 'Thai',
  'Mediterranean', 'Korean', 'Vietnamese', 'Greek', 'Spanish', 'Lebanese', 'Turkish',
  'German', 'British', 'Ethiopian', 'Moroccan', 'Brazilian', 'Peruvian', 'Fusion'
];

export function UrlUpload({ onUrlUpload, isPublicMode = false, disabled = false }: UrlUploadProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UrlUploadData>({
    url: '',
    restaurant: {
      name: '',
      address: '',
      city: '',
      country: '',
      restaurantType: '',
      cuisines: [],
      phoneNumber: '',
      description: ''
    }
  });
  
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // URL validation
    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }
    
    // Restaurant name validation
    if (!formData.restaurant.name.trim()) {
      newErrors.restaurantName = 'Restaurant name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newJob: UploadJob = {
      id: jobId,
      url: formData.url,
      restaurantName: formData.restaurant.name,
      status: 'uploading',
      progress: 0
    };
    
    setUploadJobs(prev => [...prev, newJob]);
    
    try {
      // Start progress simulation
      const progressInterval = setInterval(() => {
        setUploadJobs(prev => 
          prev.map(job => 
            job.id === jobId && job.status === 'uploading'
              ? { ...job, progress: Math.min(job.progress + Math.random() * 15, 90) }
              : job
          )
        );
      }, 500);
      
      // Submit to API
      const result = await api.uploadMenuUrl(formData);
      
      clearInterval(progressInterval);
      
      if (result.success) {
        // Set to processing
        setUploadJobs(prev => 
          prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'processing', progress: 100 }
              : job
          )
        );
        
        // Simulate processing completion
        setTimeout(() => {
          setUploadJobs(prev => 
            prev.map(job => 
              job.id === jobId 
                ? { ...job, status: 'completed' }
                : job
            )
          );
        }, 3000);
        
        // Reset form
        setFormData({
          url: '',
          restaurant: {
            name: '',
            address: '',
            city: '',
            country: '',
            restaurantType: '',
            cuisines: [],
            phoneNumber: '',
            description: ''
          }
        });
        
        if (onUrlUpload) {
          onUrlUpload(formData);
        }
      } else {
        setUploadJobs(prev => 
          prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'error', error: result.error || 'Upload failed' }
              : job
          )
        );
      }
    } catch (error) {
      console.error('URL upload error:', error);
      setUploadJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'error', error: 'Network error occurred' }
            : job
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeJob = (jobId: string) => {
    setUploadJobs(prev => prev.filter(job => job.id !== jobId));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Globe className="h-4 w-4 text-blue-500" />;
    }
  };

  const handleCuisineChange = (cuisine: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      restaurant: {
        ...prev.restaurant,
        cuisines: checked 
          ? [...(prev.restaurant.cuisines || []), cuisine]
          : (prev.restaurant.cuisines || []).filter(c => c !== cuisine)
      }
    }));
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t('urlUpload.title', 'Parse Menu from URL')}
          </CardTitle>
          <CardDescription>
            {isPublicMode 
              ? t('urlUpload.publicDescription', 'Enter a restaurant URL to automatically extract and analyze their menu. Free analysis, no signup required!')
              : t('urlUpload.description', 'Enter a restaurant URL to automatically extract and analyze their menu')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="url">{t('urlUpload.urlLabel', 'Restaurant Menu URL')} *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://restaurant.com/menu"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                className={errors.url ? 'border-red-500' : ''}
              />
              {errors.url && (
                <p className="text-sm text-red-500">{errors.url}</p>
              )}
            </div>

            {/* Restaurant Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('urlUpload.restaurantInfo', 'Restaurant Information')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurantName">{t('urlUpload.restaurantName', 'Restaurant Name')} *</Label>
                  <Input
                    id="restaurantName"
                    placeholder="Restaurant Name"
                    value={formData.restaurant.name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      restaurant: { ...prev.restaurant, name: e.target.value }
                    }))}
                    className={errors.restaurantName ? 'border-red-500' : ''}
                  />
                  {errors.restaurantName && (
                    <p className="text-sm text-red-500">{errors.restaurantName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restaurantType">{t('urlUpload.restaurantType', 'Restaurant Type')}</Label>
                  <Select
                    value={formData.restaurant.restaurantType}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      restaurant: { ...prev.restaurant, restaurantType: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurantTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('urlUpload.city', 'City')}</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.restaurant.city}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      restaurant: { ...prev.restaurant, city: e.target.value }
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">{t('urlUpload.country', 'Country')}</Label>
                  <Input
                    id="country"
                    placeholder="Country"
                    value={formData.restaurant.country}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      restaurant: { ...prev.restaurant, country: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('urlUpload.address', 'Address')}</Label>
                <Input
                  id="address"
                  placeholder="Full address"
                  value={formData.restaurant.address}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    restaurant: { ...prev.restaurant, address: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('urlUpload.cuisines', 'Cuisine Types')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {cuisineTypes.map((cuisine) => (
                    <label key={cuisine} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.restaurant.cuisines || []).includes(cuisine)}
                        onChange={(e) => handleCuisineChange(cuisine, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">{cuisine}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('urlUpload.description', 'Description')}</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the restaurant..."
                  value={formData.restaurant.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    restaurant: { ...prev.restaurant, description: e.target.value }
                  }))}
                  rows={3}
                />
              </div>
            </div>

            <Button type="submit" disabled={disabled || isSubmitting} className="w-full">
              {isSubmitting ? 'Processing...' : t('urlUpload.submit', 'Parse Menu')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('urlUpload.parseProgress', 'Parsing Progress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadJobs.map((job) => (
              <div key={job.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                {getStatusIcon(job.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.restaurantName}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.url}</p>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <Progress 
                      value={job.progress} 
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 min-w-0">
                      {Math.round(job.progress)}%
                    </span>
                  </div>
                  
                  {job.status === 'processing' && (
                    <p className="text-xs text-yellow-600 mt-1">
                      {t('urlUpload.processing', 'Analyzing menu structure...')}
                    </p>
                  )}
                  {job.status === 'completed' && (
                    <p className="text-xs text-green-600 mt-1">
                      {t('urlUpload.completed', 'Menu parsing completed')}
                    </p>
                  )}
                  {job.status === 'error' && job.error && (
                    <p className="text-xs text-red-600 mt-1">{job.error}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeJob(job.id)}
                  className="flex-shrink-0"
                >
                  ×
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('urlUpload.info', 'Our AI will attempt to extract menu items, prices, and visual prominence indicators from the provided URL. Parsing success depends on the website structure.')}
        </AlertDescription>
      </Alert>
    </div>
  );
}