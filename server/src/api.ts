import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { setEnvContext, clearEnvContext, getDatabaseUrl } from './lib/env';
import * as schema from './schema/users';
import * as menuSchema from './schema/menus';
import * as restaurantSchema from './schema/restaurants';
import * as consultationSchema from './schema/consultations';
import * as publicUploadSchema from './schema/publicUploads';
import { eq, desc } from 'drizzle-orm';
import type { UrlUploadData, PublicUploadData, PublicRestaurantData } from './types/url-parsing';
import { triageDocument } from './services/documentTriage';
// Deprecated: legacy parseQueue (V1) is no longer used by URL routes
// import { parseQueue } from './services/parseQueue';
import { parseQueueV2 } from './services/parseQueueV2';
import { analysisQueue } from './services/analysisQueue';
import { transitionDocumentStatus } from './services/stateMachine';
import { documents, parseRuns, analysisRuns } from './schema/documents';
import { rateLimitMiddleware } from './middleware/rateLimit';

type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

type Variables = {
  clientIP?: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }
  
  await next();
  // No need to clear context - env vars are the same for all requests
  // In fact, clearing the context would cause the env vars to potentially be unset for parallel requests
});

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));

// Helper function to verify reCAPTCHA token
async function verifyRecaptcha(token: string, clientIP?: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // In development mode, allow dev tokens to pass
  if (token === 'dev-token') {
    console.log('Development mode: accepting dev-token');
    return true;
  }
  
  if (!secretKey) {
    console.warn('RECAPTCHA_SECRET_KEY not configured, skipping verification');
    return true; // Allow in development if not configured
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(clientIP && { remoteip: clientIP })
      }),
    });

    const result = await response.json() as { success: boolean };
    return result.success === true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

// API routes
const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Public upload endpoints with rate limiting
const publicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
publicRoutes.use('*', rateLimitMiddleware);

// Public PDF menu upload endpoint
publicRoutes.post('/upload-menu', async (c) => {
  try {
    const body: PublicUploadData = await c.req.json();
    const clientIP = (c.get('clientIP') as string) || '127.0.0.1';
    
    // Verify reCAPTCHA
    if (!await verifyRecaptcha(body.recaptchaToken, clientIP)) {
      return c.json({
        success: false,
        error: 'reCAPTCHA verification failed',
        message: 'Please complete the reCAPTCHA verification'
      }, 400);
    }

    if (!body.file) {
      return c.json({
        success: false,
        error: 'No file provided',
        message: 'Please provide a file to upload'
      }, 400);
    }
    if (!body.file.content) {
      return c.json({
        success: false,
        error: 'No file content',
        message: 'Uploaded file content is missing'
      }, 400);
    }

    // Enforce upload size limit (10 MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (typeof body.file.size === 'number' && body.file.size > maxSizeBytes) {
      return c.json({
        success: false,
        error: 'File too large',
        message: 'Maximum upload size is 10 MB'
      }, 413);
    }

    const db = await getDatabase();
    
    // Create menu upload record for public upload
    const menuId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt: Date = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    // Create a menu upload record for tracking (no raw bytes stored)
    const menuData = {
      id: menuId,
      userId: null, // Public upload
      restaurantId: null,
      ipAddress: clientIP,
      expiresAt,
      fileName: body.file.name,
      originalFileName: body.file.name,
      fileSize: body.file.size,
      mimeType: body.file.type,
      fileUrl: null,
      sourceUrl: null,
      parseMethod: null,
      status: 'processing'
    };
    
    const menuResult = await db.insert(menuSchema.menuUploads).values(menuData).returning();
    
    // Create public upload tracking record
    const publicUploadId = `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const publicUploadData = {
      id: publicUploadId,
      ipAddress: clientIP,
      uploadType: 'pdf',
      status: 'pending',
      menuUploadId: menuResult[0].id,
      expiresAt,
    };
    
    await db.insert(publicUploadSchema.publicUploads).values(publicUploadData);
    
    // Unified pipeline: triage the uploaded file into documents and return documentId & strategy
    const triage = await triageDocument({
      type: 'file',
      source: { content: body.file.content!, mimeType: body.file.type, name: body.file.name }
    });
    // Enqueue parse job (V2) and set status queued
    try {
      await transitionDocumentStatus(triage.documentId, 'queued');
    } catch {}
    const parseJobId = parseQueueV2.enqueueParseJob(triage.documentId, 'v1');
    
    return c.json({
      success: true,
      uploadId: publicUploadId,
      menuId,
      documentId: triage.documentId,
      documentType: triage.documentType,
      processingStrategy: triage.processingStrategy,
      message: 'File received. We will process and analyze it shortly. Please provide restaurant details to receive your analysis.',
      nextStep: `/restaurant-details/${publicUploadId}`,
      parseJobId
    });
  } catch (error) {
    console.error('Public menu upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Public URL parsing endpoint
publicRoutes.post('/parse-url', async (c) => {
  try {
    const body: PublicUploadData = await c.req.json();
    const clientIP = (c.get('clientIP') as string) || '127.0.0.1';
    
    // Verify reCAPTCHA
    if (!await verifyRecaptcha(body.recaptchaToken, clientIP)) {
      return c.json({
        success: false,
        error: 'reCAPTCHA verification failed',
        message: 'Please complete the reCAPTCHA verification'
      }, 400);
    }

    if (!body.url) {
      return c.json({
        success: false,
        error: 'No URL provided',
        message: 'Please provide a URL to parse'
      }, 400);
    }

    const db = await getDatabase();
    
    // Create menu upload record for URL parsing
    const menuId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
  const menuData = {
      id: menuId,
      userId: null, // Public upload
      restaurantId: null,
      ipAddress: clientIP,
      expiresAt,
      fileName: null,
      originalFileName: null,
      fileSize: null,
      mimeType: null,
      fileUrl: body.url,
      sourceUrl: body.url,
      parseMethod: null,
      status: 'processing',
    };
    
    const menuResult = await db.insert(menuSchema.menuUploads).values(menuData).returning();
    
    // Create public upload tracking record
    const publicUploadId = `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const publicUploadData = {
      id: publicUploadId,
      ipAddress: clientIP,
      uploadType: 'url',
      status: 'processing',
      menuUploadId: menuResult[0].id,
      expiresAt,
    };
    
    await db.insert(publicUploadSchema.publicUploads).values(publicUploadData);
    
    // Create restaurant menu source record for tracking (without restaurant)
    const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sourceData = {
      id: sourceId,
      restaurantId: '', // Empty for public uploads
      userId: '', // Empty for public uploads
      url: body.url,
      sourceType: 'html' as const,
      documentType: null,
      status: 'pending' as const,
      errorMessage: null,
      lastAttemptedAt: null,
      successfullyParsedAt: null,
      parseMethod: null,
      confidence: null,
    };
    
    await db.insert(restaurantSchema.restaurantMenuSources).values(sourceData);
    
    // Create a document via triage for unified pipeline tracking
    const triage = await triageDocument({ type: 'url', source: body.url });
    // Enqueue unified parse job (V2) and set status queued
    try {
      await transitionDocumentStatus(triage.documentId, 'queued');
    } catch {}
    const v2JobId = parseQueueV2.enqueueParseJob(triage.documentId, 'v1');
    
    return c.json({
      success: true,
      uploadId: publicUploadId,
      menuId: menuResult[0].id,
      sourceId,
      documentId: triage.documentId,
      documentType: triage.documentType,
      processingStrategy: triage.processingStrategy,
      parseJobId: v2JobId,
      message: 'URL parsing started. Please provide restaurant details to receive your analysis.',
      nextStep: `/restaurant-details/${publicUploadId}`
    });
  } catch (error) {
    console.error('Public URL parsing error:', error);
    return c.json({
      success: false,
      error: 'URL parsing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Public restaurant details submission and report request
publicRoutes.post('/request-report', async (c) => {
  try {
    const body: PublicRestaurantData = await c.req.json();
    const db = await getDatabase();
    
    // Verify the upload exists and belongs to this session
    const publicUpload = await db.select()
      .from(publicUploadSchema.publicUploads)
      .where(eq(publicUploadSchema.publicUploads.id, body.uploadId))
      .limit(1);
    
    if (!publicUpload.length) {
      return c.json({
        success: false,
        error: 'Upload not found',
        message: 'The specified upload was not found or has expired'
      }, 404);
    }
    
    // Check if upload has expired
    if (new Date() > publicUpload[0].expiresAt) {
      return c.json({
        success: false,
        error: 'Upload expired',
        message: 'This upload has expired. Please upload your menu again.'
      }, 410);
    }
    
    // Save restaurant details
    const detailsId = `details_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const restaurantDetailsData = {
      id: detailsId,
      publicUploadId: body.uploadId,
      restaurantName: body.restaurantName,
      address: body.address,
      city: body.city,
      country: body.country,
      restaurantType: body.restaurantType,
      cuisines: body.cuisines ? JSON.stringify(body.cuisines) : null,
      phoneNumber: body.phoneNumber,
      description: body.description,
      reportRequested: true,
      reportRequestedAt: new Date(),
    };
    
    await db.insert(publicUploadSchema.publicRestaurantDetails).values(restaurantDetailsData);
    
    // Update public upload status
    await db.update(publicUploadSchema.publicUploads)
      .set({ 
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(publicUploadSchema.publicUploads.id, body.uploadId));
    
    return c.json({
      success: true,
      message: 'Restaurant details saved and report requested successfully.',
      reportStatus: 'generating',
      estimatedTime: '5-10 minutes'
    });
  } catch (error) {
    console.error('Public report request error:', error);
    return c.json({
      success: false,
      error: 'Failed to request report',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Mount public routes
api.route('/public', publicRoutes);

// Consultation submission endpoint - public
api.post('/consultations', async (c) => {
  try {
    const body = await c.req.json();
    const db = await getDatabase();
    
    // Generate ID
    const id = `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract consultation data
    const consultationData = {
      id,
      restaurantName: body.restaurantName,
      cuisineType: body.cuisine,
      location: body.location,
      establishedYear: body.establishedYear,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      seatingCapacity: body.seatingCapacity,
      serviceTypes: body.serviceType, // array
      priceRange: body.priceRange,
      currentChallenges: body.currentChallenges || [],
      primaryGoals: body.primaryGoals,
      timeframe: body.timeframe,
      budget: body.budget,
      additionalNotes: body.additionalNotes,
      marketingConsent: body.marketingConsent || false,
      termsAccepted: body.termsAccepted,
      source: 'website',
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
    };
    
    const result = await db.insert(consultationSchema.consultations).values(consultationData).returning();
    
    return c.json({
      success: true,
      consultationId: result[0].id,
      message: 'Consultation request submitted successfully',
    });
  } catch (error) {
    console.error('Consultation submission error:', error);
    return c.json({
      success: false,
      error: 'Failed to submit consultation request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Database test route - public for testing
api.get('/db-test', async (c) => {
  try {
    // Use external DB URL if available, otherwise use local PostgreSQL database server
    // Note: In development, the port is dynamically allocated by port-manager.js
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    
    const db = await getDatabase(dbUrl);
    const isHealthy = await testDatabaseConnection();
    
    if (!isHealthy) {
      return c.json({
        error: 'Database connection is not healthy',
        timestamp: new Date().toISOString(),
      }, 500);
    }
    
    const result = await db.select().from(schema.users).limit(5);
    
    return c.json({
      message: 'Database connection successful!',
      users: result,
      connectionHealthy: isHealthy,
      usingLocalDatabase: !getDatabaseUrl(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Protected routes - require authentication
const protectedRoutes = new Hono();

protectedRoutes.use('*', authMiddleware);

protectedRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    user,
    message: 'You are authenticated!',
  });
});

// Authenticated PDF menu upload endpoint (unified with public parsing logic)
protectedRoutes.post('/upload-menu', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json() as { file?: { name: string; size: number; type: string; content: string } };

    if (!body.file) {
      return c.json({
        success: false,
        error: 'No file provided',
        message: 'Please provide a file to upload'
      }, 400);
    }

    const db = await getDatabase();

    // Enforce upload size limit (10 MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (typeof body.file.size === 'number' && body.file.size > maxSizeBytes) {
      return c.json({
        success: false,
        error: 'File too large',
        message: 'Maximum upload size is 10 MB'
      }, 413);
    }

    // Create menu upload record for authenticated upload
    const menuId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const menuData = {
      id: menuId,
      userId: user.id,
      restaurantId: null as string | null,
      ipAddress: null as string | null,
      expiresAt: null as Date | null,
      fileName: body.file.name,
      originalFileName: body.file.name,
      fileSize: body.file.size,
      mimeType: body.file.type,
      fileUrl: null as string | null,
      sourceUrl: null as string | null,
      parseMethod: null,
      status: 'processing' as const
    };

    await db.insert(menuSchema.menuUploads).values(menuData);

    // Unified pipeline: triage and create document
    const triage = await triageDocument({
      type: 'file',
      source: { content: body.file.content!, mimeType: body.file.type, name: body.file.name },
      userId: user.id,
    });
    // Enqueue parse job (V2) and set status queued
    try {
      await transitionDocumentStatus(triage.documentId, 'queued');
    } catch {}
    const parseJobId = parseQueueV2.enqueueParseJob(triage.documentId, 'v1');

    return c.json({
      success: true,
      menuId,
      documentId: triage.documentId,
      documentType: triage.documentType,
      processingStrategy: triage.processingStrategy,
      message: 'File received. We will process and analyze it shortly.',
      parseJobId
    });
  } catch (error) {
    console.error('Authenticated menu upload error:', error);
    return c.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Menu upload endpoint
protectedRoutes.post('/menus/upload', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = await getDatabase();
    
    // Generate ID
    const id = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In a real implementation, you'd handle file upload to cloud storage here
    // For now, we'll simulate the upload process
    const menuData = {
      id,
      userId: user.id,
      fileName: body.fileName || 'uploaded_menu.pdf',
      originalFileName: body.originalFileName || body.fileName,
      fileSize: body.fileSize || 0,
      mimeType: body.mimeType || 'application/pdf',
      fileUrl: body.fileUrl || `/uploads/${id}`, // Placeholder URL
      status: 'processing',
    };
    
    const result = await db.insert(menuSchema.menuUploads).values(menuData).returning();
    
    // Simulate processing (in real implementation, this would be async)
    setTimeout(async () => {
      try {
        const mockAnalysis = {
          totalItems: 45,
          avgPrice: '18.50',
          minPrice: '8.00',
          maxPrice: '32.00',
          profitabilityScore: 72,
          readabilityScore: 85,
          pricingOptimizationScore: 68,
          categoryBalanceScore: 78,
          analysisData: {
            categories: ['Appetizers', 'Mains', 'Desserts', 'Beverages'],
            recommendations: [
              {
                type: 'pricing',
                priority: 'high',
                title: 'Optimize Premium Dish Pricing',
                description: 'Your signature dishes are underpriced by 15-20% compared to market standards.',
                impact: '+12% revenue potential'
              }
            ]
          },
          status: 'completed',
          processingCompletedAt: new Date(),
        };
        
        await db.update(menuSchema.menuUploads)
          .set(mockAnalysis)
          .where(eq(menuSchema.menuUploads.id, id));
      } catch (error) {
        console.error('Error updating menu analysis:', error);
      }
    }, 3000);
    
    return c.json({
      success: true,
      menuId: result[0].id,
      message: 'Menu upload started successfully',
    });
  } catch (error) {
    console.error('Menu upload error:', error);
    return c.json({
      success: false,
      error: 'Failed to upload menu',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's menus
protectedRoutes.get('/menus', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase();
    
    const menus = await db.select()
      .from(menuSchema.menuUploads)
      .where(eq(menuSchema.menuUploads.userId, user.id))
      .orderBy(desc(menuSchema.menuUploads.createdAt));
    // Strip large/raw file content from analysisData before returning
    const sanitizedMenus = menus.map((menu: any) => {
      if (menu && menu.analysisData && typeof menu.analysisData === 'object') {
        const { fileContent, ...restAnalysis } = menu.analysisData as Record<string, any>;
        // Ensure raw bytes are removed if accidentally present
        return { ...menu, analysisData: restAnalysis };
      }
      return menu;
    });

    return c.json({
      success: true,
      menus: sanitizedMenus,
    });
  } catch (error) {
    console.error('Get menus error:', error);
    return c.json({
      success: false,
      error: 'Failed to retrieve menus',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get specific menu analysis
protectedRoutes.get('/menus/:id', async (c) => {
  try {
    const user = c.get('user');
    const menuId = c.req.param('id');
    const db = await getDatabase();
    
    const menu = await db.select()
      .from(menuSchema.menuUploads)
      .where(eq(menuSchema.menuUploads.id, menuId));
    
    if (!menu.length || menu[0].userId !== user.id) {
      return c.json({
        success: false,
        error: 'Menu not found or access denied',
      }, 404);
    }
    // Sanitize analysisData to remove raw file content
    const dbMenu = menu[0] as any;
    const sanitizedMenu = dbMenu && dbMenu.analysisData && typeof dbMenu.analysisData === 'object'
      ? { ...dbMenu, analysisData: (({ fileContent, ...rest }) => rest)(dbMenu.analysisData as Record<string, any>) }
      : dbMenu;

    // Get recommendations for this menu
    const recommendations = await db.select()
      .from(menuSchema.menuRecommendations)
      .where(eq(menuSchema.menuRecommendations.menuId, menuId));
    
    return c.json({
      success: true,
      menu: sanitizedMenu,
      recommendations,
    });
  } catch (error) {
    console.error('Get menu error:', error);
    return c.json({
      success: false,
      error: 'Failed to retrieve menu',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Restaurant management endpoints
protectedRoutes.post('/restaurants', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = await getDatabase();
    
    // Generate ID
    const id = `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const restaurantData = {
      id,
      userId: user.id,
      name: body.name,
      url: body.url,
      address: body.address,
      city: body.city,
      country: body.country,
      restaurantType: body.restaurantType,
      cuisines: body.cuisines,
      phoneNumber: body.phoneNumber,
      description: body.description,
    };
    
    const result = await db.insert(restaurantSchema.restaurants).values(restaurantData).returning();
    
    return c.json({
      success: true,
      restaurant: result[0],
      message: 'Restaurant created successfully',
    });
  } catch (error) {
    console.error('Restaurant creation error:', error);
    return c.json({
      success: false,
      error: 'Failed to create restaurant',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's restaurants
protectedRoutes.get('/restaurants', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase();
    
    // Filter restaurants by user
    const restaurants = await db.select()
      .from(restaurantSchema.restaurants)
      .where(eq(restaurantSchema.restaurants.userId, user.id))
      .orderBy(desc(restaurantSchema.restaurants.createdAt));
    
    return c.json({
      success: true,
      restaurants,
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    return c.json({
      success: false,
      error: 'Failed to retrieve restaurants',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get restaurant's menus
protectedRoutes.get('/restaurants/:id/menus', async (c) => {
  try {
    const user = c.get('user');
    const restaurantId = c.req.param('id');
    const db = await getDatabase();
    
    const menus = await db.select()
      .from(menuSchema.menuUploads)
      .where(eq(menuSchema.menuUploads.restaurantId, restaurantId))
      .orderBy(desc(menuSchema.menuUploads.createdAt));
    // Strip large/raw file content from analysisData before returning
    const sanitizedMenus = menus.map((menu: any) => {
      if (menu && menu.analysisData && typeof menu.analysisData === 'object') {
        const { fileContent, ...restAnalysis } = menu.analysisData as Record<string, any>;
        return { ...menu, analysisData: restAnalysis };
      }
      return menu;
    });

    return c.json({
      success: true,
      menus: sanitizedMenus,
    });
  } catch (error) {
    console.error('Get restaurant menus error:', error);
    return c.json({
      success: false,
      error: 'Failed to retrieve restaurant menus',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// URL-based menu parsing endpoint
protectedRoutes.post('/menus/parse-url', async (c) => {
  try {
    const user = c.get('user');
    const body: UrlUploadData = await c.req.json();
    const db = await getDatabase();
    
    // First, create or find the restaurant
    let restaurantId = body.restaurant.name ? 
      `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : 
      null;
    
    if (restaurantId) {
      const restaurantData = {
        id: restaurantId,
        userId: user.id,
        name: body.restaurant.name,
        url: body.url,
        address: body.restaurant.address,
        city: body.restaurant.city,
        country: body.restaurant.country,
        restaurantType: body.restaurant.restaurantType,
        cuisines: body.restaurant.cuisines,
        phoneNumber: body.restaurant.phoneNumber,
        description: body.restaurant.description,
      };
      
      await db.insert(restaurantSchema.restaurants).values(restaurantData);
    }
    
    // Create menu upload record for URL parsing
    const menuId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const menuData = {
      id: menuId,
      userId: user.id,
      restaurantId,
      fileName: null,
      originalFileName: null,
      fileSize: null,
      mimeType: null,
      fileUrl: body.url,
      sourceUrl: body.url,
      parseMethod: null, // Will be determined by parser
      status: 'processing',
    };
    
    const menuResult = await db.insert(menuSchema.menuUploads).values(menuData).returning();
    
    // Create restaurant menu source record for tracking
    const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sourceData = {
      id: sourceId,
      restaurantId: restaurantId || '',
      userId: user.id,
      url: body.url,
      sourceType: 'html' as const, // Default to HTML, parser will update
      documentType: null,
      status: 'pending' as const,
      errorMessage: null,
      lastAttemptedAt: null,
      successfullyParsedAt: null,
      parseMethod: null,
      confidence: null,
    };
    
    await db.insert(restaurantSchema.restaurantMenuSources).values(sourceData);
    
    // Unified pipeline: triage URL into documents and enqueue V2 parse job
    const triage = await triageDocument({ type: 'url', source: body.url, userId: user.id });
    try {
      await transitionDocumentStatus(triage.documentId, 'queued');
    } catch {}
    const parseJobId = parseQueueV2.enqueueParseJob(triage.documentId, 'v1');

    return c.json({
      success: true,
      menuId: menuResult[0].id,
      restaurantId,
      sourceId,
      documentId: triage.documentId,
      documentType: triage.documentType,
      processingStrategy: triage.processingStrategy,
      parseJobId,
      message: 'URL parsing started successfully',
    });
  } catch (error) {
    console.error('URL parsing error:', error);
    return c.json({
      success: false,
      error: 'Failed to start URL parsing',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Mount the protected routes under /protected
api.route('/protected', protectedRoutes);

// Document status endpoint for polling
api.get('/documents/:documentId/status', async (c) => {
  try {
    const db = await getDatabase();
    const documentId = c.req.param('documentId');
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }
  // Latest parse run
  const latestParseRun = (await db.select().from(parseRuns)
    .where(eq(parseRuns.documentId, documentId))
    .orderBy(desc(parseRuns.startedAt))
    .limit(1))[0] as any;
  // Latest analysis run across all runs for this document
  let latestAnalysisRun: any = undefined;
  const allParseRuns = await db.select().from(parseRuns)
    .where(eq(parseRuns.documentId, documentId))
    .orderBy(desc(parseRuns.startedAt));
  if (allParseRuns.length) {
    // Fetch latest analysis among all parse runs
    const analyses: any[] = [];
    for (const pr of allParseRuns as any[]) {
      const ar = (await db.select().from(analysisRuns)
        .where(eq(analysisRuns.parseRunId, pr.id))
        .orderBy(desc(analysisRuns.startedAt))
        .limit(1))[0] as any;
      if (ar) analyses.push(ar);
    }
    analyses.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    latestAnalysisRun = analyses[0];
  }

    // Sanitize and shape response
    const docResp = {
      id: (doc as any).id,
      status: (doc as any).status,
      statusReason: (doc as any).statusReason,
      documentType: (doc as any).documentType,
      sourceType: (doc as any).sourceType,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
    const parseResp = latestParseRun ? {
      id: latestParseRun.id,
      status: latestParseRun.status,
      parseMethod: latestParseRun.parseMethod,
      confidence: latestParseRun.confidence,
      errorMessage: latestParseRun.errorMessage,
      startedAt: latestParseRun.startedAt,
      completedAt: latestParseRun.completedAt,
    } : null;
    const analysisResp = latestAnalysisRun ? {
      id: latestAnalysisRun.id,
      status: latestAnalysisRun.status,
      analysisVersion: latestAnalysisRun.analysisVersion,
      metrics: latestAnalysisRun.metrics,
      errorMessage: latestAnalysisRun.errorMessage,
      startedAt: latestAnalysisRun.startedAt,
      completedAt: latestAnalysisRun.completedAt,
    } : null;

    return c.json({ document: docResp, parseRun: parseResp, analysisRun: analysisResp });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return c.json({ error: 'Failed to fetch status' }, 500);
  }
});

// Mount the API router
app.route('/api/v1', api);

export default app; 