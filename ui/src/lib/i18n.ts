import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Header translations
      header: {
        brand: 'Menu Insights',
        nav: {
          features: 'Features',
          featuresDesc: 'Discover what makes our menu analysis powerful',
          pricing: 'Pricing',
          pricingDesc: 'Simple, transparent pricing for restaurants of all sizes',
          demo: 'Demo',
          demoDesc: 'See our consultation process in action',
          about: 'About',
          aboutDesc: 'Learn more about our mission and team'
        },
        signIn: 'Sign In',
        getStarted: 'Get Started'
      },
      
      // Landing page translations
      landing: {
        badge: 'Powered by AI',
        description: 'Upload your menu and get instant AI-powered insights to optimize pricing, improve item placement, and boost your restaurant\'s profitability by up to 35%.',
        getStarted: 'Start Free Analysis',
        watchDemo: 'Watch Demo',
        stats: {
          menusAnalyzed: 'Menus Analyzed',
          avgIncrease: 'Avg Revenue Increase',
          restaurants: 'Restaurants Trust Us',
          satisfaction: 'Customer Satisfaction'
        },
        features: {
          upload: {
            title: 'Easy Upload',
            description: 'Simply drag and drop your menu PDFs or images'
          },
          analysis: {
            title: 'Smart Analysis',
            description: 'AI-powered insights into your menu performance'
          },
          optimization: {
            title: 'Revenue Optimization',
            description: 'Actionable recommendations to boost revenue'
          },
          multilingual: {
            title: 'Multi-language',
            description: 'Support for multiple languages and cuisines'
          }
        },
        cta: {
          button: 'Start Free Analysis',
          signIn: 'Sign In'
        }
      },
      
      // Hero translations
      hero: {
        badge: 'Powered by AI',
        title: 'Transform Your Restaurant Menu Into Revenue',
        description: 'Upload your menu and get instant AI-powered insights to optimize pricing, improve item placement, and boost your restaurant\'s profitability.',
        getStarted: 'Get Started Free',
        learnMore: 'Learn More',
        stats: {
          menusAnalyzed: 'Menus Analyzed',
          avgIncrease: 'Avg Revenue Increase',
          restaurants: 'Restaurants Trust Us'
        },
        features: {
          upload: {
            title: 'Easy Upload',
            description: 'Simply drag and drop your menu PDFs or images'
          },
          analysis: {
            title: 'Smart Analysis',
            description: 'AI-powered insights into your menu performance'
          },
          optimization: {
            title: 'Optimization Tips',
            description: 'Actionable recommendations to boost revenue'
          },
          multilingual: {
            title: 'Multi-language',
            description: 'Support for multiple languages and cuisines'
          }
        },
        howItWorks: {
          title: 'How It Works',
          description: 'Get insights from your menu in three simple steps'
        },
        steps: {
          upload: {
            title: 'Upload Your Menu',
            description: 'Drag and drop your menu PDF or image files'
          },
          analyze: {
            title: 'AI Analysis',
            description: 'Our AI analyzes pricing, layout, and item performance'
          },
          optimize: {
            title: 'Get Insights',
            description: 'Receive actionable recommendations to increase revenue'
          }
        },
        cta: {
          title: 'Ready to Optimize Your Menu?',
          description: 'Join hundreds of restaurants using AI to increase their revenue and improve customer satisfaction.',
          button: 'Start Free Analysis'
        }
      },

      // Menu Upload translations
      menuUpload: {
        title: 'Upload Your Menu',
        description: 'Upload PDF files or images of your restaurant menu for analysis',
        dropHere: 'Drop your files here...',
        dragDrop: 'Drag and drop your menu files here, or click to browse',
        supportedFormats: 'Supported formats: PDF, PNG, JPG, JPEG',
        maxFilesReached: 'Maximum {{count}} files reached',
        uploadProgress: 'Upload Progress',
        processing: 'Processing menu...',
        completed: 'Analysis completed'
      },

      // Menu Insights translations
      menuInsights: {
        title: 'Menu Insights Dashboard',
        subtitle: 'Analyze your menu performance and get actionable recommendations',
        tabs: {
          overview: 'Overview',
          upload: 'Upload PDF',
          history: 'Analysis History'
        },
        metrics: {
          profitability: 'Profitability',
          readability: 'Readability',
          pricing: 'Pricing',
          balance: 'Category Balance'
        },
        stats: {
          totalItems: 'Total Menu Items',
          avgPrice: 'Average Price',
          priceRange: 'Price Range'
        },
        recommendations: {
          title: 'Key Recommendations',
          description: 'Actionable insights to improve your menu performance'
        },
        noAnalyses: {
          title: 'No Menu Analyses Yet',
          description: 'Upload your first menu to get started with AI-powered insights',
          uploadButton: 'Upload Your First Menu'
        },
        history: {
          title: 'Analysis History',
          description: 'View all your previous menu analyses',
          uploadedOn: 'Uploaded on',
          viewDetails: 'View Details',
          downloadReport: 'Download Report'
        }
      },

      // Consultation translations
      consultation: {
        title: 'Restaurant Consultation Demo',
        description: 'Experience our consultation process with this interactive demo. Fill out this form to see how we gather information to provide personalized menu insights.',
        progress: 'Step {{current}} of {{total}}',
        prev: 'Previous',
        next: 'Next',
        submit: 'Submit Demo',
        steps: {
          business: {
            title: 'Business Information',
            description: 'Tell us about your restaurant'
          },
          contact: {
            title: 'Contact & Details',
            description: 'Contact information and operational details'
          },
          goals: {
            title: 'Goals & Preferences',
            description: 'What are your objectives and timeline?'
          },
          review: {
            title: 'Review & Submit',
            description: 'Review your information before submitting'
          }
        },
        form: {
          restaurantName: 'Restaurant Name',
          restaurantNamePlaceholder: 'Enter restaurant name',
          cuisine: 'Cuisine Type',
          cuisinePlaceholder: 'Select cuisine type',
          location: 'Location',
          locationPlaceholder: 'City, State/Country',
          established: 'Year Established',
          contactName: 'Contact Name',
          contactNamePlaceholder: 'Your full name',
          email: 'Email Address',
          phone: 'Phone Number',
          seating: 'Seating Capacity',
          seatingPlaceholder: 'Select capacity',
          serviceType: 'Service Type',
          dineIn: 'Dine-in',
          takeout: 'Takeout',
          delivery: 'Delivery',
          catering: 'Catering',
          priceRange: 'Price Range',
          budget: 'Budget ($-$$)',
          midRange: 'Mid-range ($$$)',
          upscale: 'Upscale ($$$$)',
          fineDining: 'Fine Dining ($$$$$)',
          challenges: 'Current Challenges',
          lowMargins: 'Low profit margins',
          menuComplexity: 'Menu too complex',
          pricing: 'Pricing strategy',
          competition: 'Strong competition',
          retention: 'Customer retention',
          costControl: 'Food cost control',
          goals: 'Primary Goals',
          increaseRevenue: 'Increase revenue',
          reduceCosts: 'Reduce food costs',
          efficiency: 'Improve kitchen efficiency',
          experience: 'Enhance customer experience',
          expand: 'Expand menu offerings',
          layout: 'Optimize menu layout',
          timeframe: 'Implementation Timeframe',
          timeframePlaceholder: 'Select timeframe',
          budgetPlaceholder: 'Select budget range',
          notes: 'Additional Notes',
          notesPlaceholder: 'Any additional information or specific questions...',
          marketing: 'I agree to receive marketing communications',
          terms: 'I accept the terms and conditions',
          disclaimer: 'Demo Disclaimer',
          disclaimerText: 'This is a demonstration form. No actual consultation will be scheduled, but you can see how our real consultation process works.'
        },
        success: {
          title: 'Thank You!',
          message: 'Your consultation request has been submitted successfully. Our team will contact you within 24 hours to schedule your personalized menu analysis session.',
          nextSteps: 'What happens next:',
          step1: 'Team review within 24 hours',
          step2: 'Schedule consultation call',
          step3: 'Receive preliminary recommendations',
          backHome: 'Back to Home'
        }
      }
    }
  },
  nl: {
    translation: {
      // Dutch translations (basic set for demonstration)
      header: {
        brand: 'Menu Inzichten',
        nav: {
          features: 'Functies',
          pricing: 'Prijzen',
          demo: 'Demo',
          about: 'Over ons'
        },
        signIn: 'Inloggen',
        getStarted: 'Aan de slag'
      },
      hero: {
        title: 'Transformeer Uw Restaurant Menu in Omzet',
        description: 'Upload uw menu en krijg direct AI-aangedreven inzichten om prijzen te optimaliseren, itemplaatsing te verbeteren en de winstgevendheid van uw restaurant te verhogen.',
        getStarted: 'Gratis beginnen',
        learnMore: 'Meer informatie'
      },
      menuInsights: {
        title: 'Menu Inzichten Dashboard',
        subtitle: 'Analyseer uw menuprestaties en krijg bruikbare aanbevelingen'
      },
      consultation: {
        title: 'Restaurant Consultatie Demo',
        description: 'Ervaar ons consultatieproces met deze interactieve demo.'
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    
    interpolation: {
      escapeValue: false // React already handles escaping
    },

    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

export default i18n;