import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { setEnvContext, clearEnvContext, getDatabaseUrl } from './lib/env';
import * as schema from './schema/users';
import * as menuSchema from './schema/menus';
import * as consultationSchema from './schema/consultations';
import { eq, desc } from 'drizzle-orm';

type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

const app = new Hono<{ Bindings: Env }>();

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

// API routes
const api = new Hono();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

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
      userId: user.uid,
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
      .where(eq(menuSchema.menuUploads.userId, user.uid))
      .orderBy(desc(menuSchema.menuUploads.createdAt));
    
    return c.json({
      success: true,
      menus,
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
    
    if (!menu.length || menu[0].userId !== user.uid) {
      return c.json({
        success: false,
        error: 'Menu not found or access denied',
      }, 404);
    }
    
    // Get recommendations for this menu
    const recommendations = await db.select()
      .from(menuSchema.menuRecommendations)
      .where(eq(menuSchema.menuRecommendations.menuId, menuId));
    
    return c.json({
      success: true,
      menu: menu[0],
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

// Mount the protected routes under /protected
api.route('/protected', protectedRoutes);

// Mount the API router
app.route('/api/v1', api);

export default app; 