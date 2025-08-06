import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';

import { Header } from '@/components/Header';
import { 
  ChefHat, 
  Users, 
  DollarSign, 
  Building,
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/serverComm';

const consultationSchema = z.object({
  // Business Information
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  cuisine: z.string().min(1, 'Cuisine type is required'),
  location: z.string().min(1, 'Location is required'),
  establishedYear: z.string().optional(),
  
  // Contact Information
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  
  // Business Details
  seatingCapacity: z.string().min(1, 'Seating capacity is required'),
  serviceType: z.array(z.string()).min(1, 'Select at least one service type'),
  priceRange: z.string().min(1, 'Price range is required'),
  currentChallenges: z.array(z.string()),
  
  // Goals and Preferences
  primaryGoals: z.array(z.string()).min(1, 'Select at least one goal'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  budget: z.string().min(1, 'Budget range is required'),
  additionalNotes: z.string().optional(),
  
  // Consent
  marketingConsent: z.boolean().optional(),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms')
});

type ConsultationForm = z.infer<typeof consultationSchema>;

export function ConsultationDemo() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const totalSteps = 4;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues
  } = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      serviceType: [],
      currentChallenges: [],
      primaryGoals: [],
      marketingConsent: false,
      termsAccepted: false
    }
  });

  const watchedServiceType = watch('serviceType') || [];
  const watchedChallenges = watch('currentChallenges') || [];
  const watchedGoals = watch('primaryGoals') || [];

  const onSubmit = async (data: ConsultationForm) => {
    try {
      console.log('Consultation form submitted:', data);
      
      const result = await api.submitConsultation(data);
      
      if (result.success) {
        setIsSubmitted(true);
      } else {
        console.error('Consultation submission failed:', result.error);
        // In a real app, you'd show an error message to the user
      }
    } catch (error) {
      console.error('Consultation submission error:', error);
      // In a real app, you'd show an error message to the user
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateArrayField = (field: keyof ConsultationForm, value: string, checked: boolean) => {
    const current = getValues(field) as string[];
    if (checked) {
      setValue(field, [...current, value] as any);
    } else {
      setValue(field, current.filter(item => item !== value) as any);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header showAuth={false} />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-4">
                {t('consultation.success.title', 'Thank You!')}
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                {t('consultation.success.message', 'Your consultation request has been submitted successfully. Our team will contact you within 24 hours to schedule your personalized menu analysis session.')}
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t('consultation.success.nextSteps', 'What happens next:')}</p>
                <ul className="text-left max-w-md mx-auto space-y-1">
                  <li>• {t('consultation.success.step1', 'Team review within 24 hours')}</li>
                  <li>• {t('consultation.success.step2', 'Schedule consultation call')}</li>
                  <li>• {t('consultation.success.step3', 'Receive preliminary recommendations')}</li>
                </ul>
              </div>
              <Button className="mt-6" onClick={() => window.location.href = '/'}>
                {t('consultation.success.backHome', 'Back to Home')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header showAuth={false} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
            <ChefHat className="h-8 w-8 text-primary" />
            {t('consultation.title', 'Restaurant Consultation Demo')}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('consultation.description', 'Experience our consultation process with this interactive demo. Fill out this form to see how we gather information to provide personalized menu insights.')}
          </p>
        </div>

        {/* Progress */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {t('consultation.progress', 'Step {{current}} of {{total}}', { current: currentStep, total: totalSteps })}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round((currentStep / totalSteps) * 100)}%
            </span>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStep === 1 && <Building className="h-5 w-5" />}
                {currentStep === 2 && <Users className="h-5 w-5" />}
                {currentStep === 3 && <DollarSign className="h-5 w-5" />}
                {currentStep === 4 && <CheckCircle className="h-5 w-5" />}
                
                {currentStep === 1 && t('consultation.steps.business.title', 'Business Information')}
                {currentStep === 2 && t('consultation.steps.contact.title', 'Contact & Details')}
                {currentStep === 3 && t('consultation.steps.goals.title', 'Goals & Preferences')}
                {currentStep === 4 && t('consultation.steps.review.title', 'Review & Submit')}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 && t('consultation.steps.business.description', 'Tell us about your restaurant')}
                {currentStep === 2 && t('consultation.steps.contact.description', 'Contact information and operational details')}
                {currentStep === 3 && t('consultation.steps.goals.description', 'What are your objectives and timeline?')}
                {currentStep === 4 && t('consultation.steps.review.description', 'Review your information before submitting')}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Step 1: Business Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="restaurantName">{t('consultation.form.restaurantName', 'Restaurant Name')} *</Label>
                      <Input
                        id="restaurantName"
                        {...register('restaurantName')}
                        placeholder={t('consultation.form.restaurantNamePlaceholder', 'Enter restaurant name')}
                      />
                      {errors.restaurantName && (
                        <p className="text-sm text-red-500 mt-1">{errors.restaurantName.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="cuisine">{t('consultation.form.cuisine', 'Cuisine Type')} *</Label>
                      <Select onValueChange={(value) => setValue('cuisine', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('consultation.form.cuisinePlaceholder', 'Select cuisine type')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="italian">Italian</SelectItem>
                          <SelectItem value="french">French</SelectItem>
                          <SelectItem value="american">American</SelectItem>
                          <SelectItem value="asian">Asian</SelectItem>
                          <SelectItem value="mediterranean">Mediterranean</SelectItem>
                          <SelectItem value="mexican">Mexican</SelectItem>
                          <SelectItem value="fusion">Fusion</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.cuisine && (
                        <p className="text-sm text-red-500 mt-1">{errors.cuisine.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location">{t('consultation.form.location', 'Location')} *</Label>
                      <Input
                        id="location"
                        {...register('location')}
                        placeholder={t('consultation.form.locationPlaceholder', 'City, State/Country')}
                      />
                      {errors.location && (
                        <p className="text-sm text-red-500 mt-1">{errors.location.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="establishedYear">{t('consultation.form.established', 'Year Established')}</Label>
                      <Input
                        id="establishedYear"
                        type="number"
                        {...register('establishedYear')}
                        placeholder="2020"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact & Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">{t('consultation.form.contactName', 'Contact Name')} *</Label>
                      <Input
                        id="contactName"
                        {...register('contactName')}
                        placeholder={t('consultation.form.contactNamePlaceholder', 'Your full name')}
                      />
                      {errors.contactName && (
                        <p className="text-sm text-red-500 mt-1">{errors.contactName.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="email">{t('consultation.form.email', 'Email Address')} *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        placeholder="email@example.com"
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">{t('consultation.form.phone', 'Phone Number')} *</Label>
                      <Input
                        id="phone"
                        {...register('phone')}
                        placeholder="+1 (555) 123-4567"
                      />
                      {errors.phone && (
                        <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="seatingCapacity">{t('consultation.form.seating', 'Seating Capacity')} *</Label>
                      <Select onValueChange={(value) => setValue('seatingCapacity', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('consultation.form.seatingPlaceholder', 'Select capacity')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under-25">Under 25</SelectItem>
                          <SelectItem value="25-50">25-50</SelectItem>
                          <SelectItem value="50-100">50-100</SelectItem>
                          <SelectItem value="100-200">100-200</SelectItem>
                          <SelectItem value="over-200">Over 200</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.seatingCapacity && (
                        <p className="text-sm text-red-500 mt-1">{errors.seatingCapacity.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>{t('consultation.form.serviceType', 'Service Type')} *</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { value: 'dine-in', label: t('consultation.form.dineIn', 'Dine-in') },
                        { value: 'takeout', label: t('consultation.form.takeout', 'Takeout') },
                        { value: 'delivery', label: t('consultation.form.delivery', 'Delivery') },
                        { value: 'catering', label: t('consultation.form.catering', 'Catering') }
                      ].map((service) => (
                        <div key={service.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={service.value}
                            checked={watchedServiceType.includes(service.value)}
                            onCheckedChange={(checked) => 
                              updateArrayField('serviceType', service.value, !!checked)
                            }
                          />
                          <Label htmlFor={service.value} className="text-sm">
                            {service.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.serviceType && (
                      <p className="text-sm text-red-500 mt-1">{errors.serviceType.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>{t('consultation.form.priceRange', 'Price Range')} *</Label>
                    <RadioGroup 
                      onValueChange={(value) => setValue('priceRange', value)}
                      className="mt-2"
                    >
                      {[
                        { value: 'budget', label: t('consultation.form.budget', 'Budget ($-$$)') },
                        { value: 'mid-range', label: t('consultation.form.midRange', 'Mid-range ($$$)') },
                        { value: 'upscale', label: t('consultation.form.upscale', 'Upscale ($$$$)') },
                        { value: 'fine-dining', label: t('consultation.form.fineDining', 'Fine Dining ($$$$$)') }
                      ].map((price) => (
                        <div key={price.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={price.value} id={price.value} />
                          <Label htmlFor={price.value}>{price.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {errors.priceRange && (
                      <p className="text-sm text-red-500 mt-1">{errors.priceRange.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Goals & Preferences */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('consultation.form.challenges', 'Current Challenges')}</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {[
                        { value: 'low-margins', label: t('consultation.form.lowMargins', 'Low profit margins') },
                        { value: 'menu-complexity', label: t('consultation.form.menuComplexity', 'Menu too complex') },
                        { value: 'pricing', label: t('consultation.form.pricing', 'Pricing strategy') },
                        { value: 'competition', label: t('consultation.form.competition', 'Strong competition') },
                        { value: 'customer-retention', label: t('consultation.form.retention', 'Customer retention') },
                        { value: 'cost-control', label: t('consultation.form.costControl', 'Food cost control') }
                      ].map((challenge) => (
                        <div key={challenge.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={challenge.value}
                            checked={watchedChallenges.includes(challenge.value)}
                            onCheckedChange={(checked) => 
                              updateArrayField('currentChallenges', challenge.value, !!checked)
                            }
                          />
                          <Label htmlFor={challenge.value} className="text-sm">
                            {challenge.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>{t('consultation.form.goals', 'Primary Goals')} *</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {[
                        { value: 'increase-revenue', label: t('consultation.form.increaseRevenue', 'Increase revenue') },
                        { value: 'reduce-costs', label: t('consultation.form.reduceCosts', 'Reduce food costs') },
                        { value: 'improve-efficiency', label: t('consultation.form.efficiency', 'Improve kitchen efficiency') },
                        { value: 'enhance-experience', label: t('consultation.form.experience', 'Enhance customer experience') },
                        { value: 'expand-offerings', label: t('consultation.form.expand', 'Expand menu offerings') },
                        { value: 'optimize-layout', label: t('consultation.form.layout', 'Optimize menu layout') }
                      ].map((goal) => (
                        <div key={goal.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={goal.value}
                            checked={watchedGoals.includes(goal.value)}
                            onCheckedChange={(checked) => 
                              updateArrayField('primaryGoals', goal.value, !!checked)
                            }
                          />
                          <Label htmlFor={goal.value} className="text-sm">
                            {goal.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.primaryGoals && (
                      <p className="text-sm text-red-500 mt-1">{errors.primaryGoals.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{t('consultation.form.timeframe', 'Implementation Timeframe')} *</Label>
                      <Select onValueChange={(value) => setValue('timeframe', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('consultation.form.timeframePlaceholder', 'Select timeframe')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate (1-2 weeks)</SelectItem>
                          <SelectItem value="short-term">Short-term (1-3 months)</SelectItem>
                          <SelectItem value="medium-term">Medium-term (3-6 months)</SelectItem>
                          <SelectItem value="long-term">Long-term (6+ months)</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.timeframe && (
                        <p className="text-sm text-red-500 mt-1">{errors.timeframe.message}</p>
                      )}
                    </div>

                    <div>
                      <Label>{t('consultation.form.budget', 'Consultation Budget')} *</Label>
                      <Select onValueChange={(value) => setValue('budget', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('consultation.form.budgetPlaceholder', 'Select budget range')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under-1k">Under $1,000</SelectItem>
                          <SelectItem value="1k-5k">$1,000 - $5,000</SelectItem>
                          <SelectItem value="5k-10k">$5,000 - $10,000</SelectItem>
                          <SelectItem value="over-10k">Over $10,000</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.budget && (
                        <p className="text-sm text-red-500 mt-1">{errors.budget.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="additionalNotes">{t('consultation.form.notes', 'Additional Notes')}</Label>
                    <Textarea
                      id="additionalNotes"
                      {...register('additionalNotes')}
                      placeholder={t('consultation.form.notesPlaceholder', 'Any additional information or specific questions...')}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Review & Submit */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="marketingConsent"
                        {...register('marketingConsent')}
                      />
                      <Label htmlFor="marketingConsent" className="text-sm">
                        {t('consultation.form.marketing', 'I agree to receive marketing communications')}
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="termsAccepted"
                        {...register('termsAccepted')}
                      />
                      <Label htmlFor="termsAccepted" className="text-sm">
                        {t('consultation.form.terms', 'I accept the terms and conditions')} *
                      </Label>
                    </div>
                    {errors.termsAccepted && (
                      <p className="text-sm text-red-500">{errors.termsAccepted.message}</p>
                    )}
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">
                      {t('consultation.form.disclaimer', 'Demo Disclaimer')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t('consultation.form.disclaimerText', 'This is a demonstration form. No actual consultation will be scheduled, but you can see how our real consultation process works.')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Navigation */}
            <div className="flex justify-between p-6 pt-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('consultation.prev', 'Previous')}
              </Button>
              
              {currentStep < totalSteps ? (
                <Button type="button" onClick={nextStep}>
                  {t('consultation.next', 'Next')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit">
                  {t('consultation.submit', 'Submit Demo')}
                  <CheckCircle className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}