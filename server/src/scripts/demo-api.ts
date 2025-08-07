import { getDatabase } from '../lib/db';
import * as userSchema from '../schema/users';
import * as restaurantSchema from '../schema/restaurants';
import { parseQueue } from '../services/parseQueue';

async function demoApiWorkflow() {
  try {
    console.log('🚀 Demonstrating Complete API Workflow\n');
    
    const db = await getDatabase();
    
    // Step 1: Create a test user (normally done by Firebase Auth)
    console.log('👥 Step 1: Creating test user...');
    const userId = 'demo_user_' + Date.now();
    const user = {
      id: userId,
      email: 'demo@example.com',
      display_name: 'Demo User',
      photo_url: null
    };
    
    await db.insert(userSchema.users).values(user);
    console.log(`✅ User created: ${user.email}`);
    console.log('');
    
    // Step 2: Simulate URL submission
    console.log('🏪 Step 2: Creating restaurant and menu source...');
    const restaurantId = `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const restaurantData = {
      id: restaurantId,
      userId: userId,
      name: 'Demo Restaurant',
      url: 'https://www.momijisushi-denhaag.nl/',
      address: '123 Test Street',
      city: 'The Hague',
      country: 'Netherlands',
      latitude: null,
      longitude: null,
      restaurantType: 'fine-dining',
      cuisines: ['Japanese', 'Sushi'],
      phoneNumber: '+31 70 123 4567',
      description: 'Demo Japanese restaurant for testing',
    };
    
    await db.insert(restaurantSchema.restaurants).values(restaurantData);
    console.log(`✅ Restaurant created: ${restaurantData.name}`);
    
    // Create menu source
    const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sourceData = {
      id: sourceId,
      restaurantId: restaurantId,
      userId: userId,
      url: 'https://www.momijisushi-denhaag.nl/menu/',
      sourceType: 'html' as const,
      documentType: 'html_static',
      status: 'pending' as const,
      errorMessage: null,
      lastAttemptedAt: null,
      successfullyParsedAt: null,
      parseMethod: null,
      confidence: null,
    };
    
    await db.insert(restaurantSchema.restaurantMenuSources).values(sourceData);
    console.log(`✅ Menu source created: ${sourceData.url}`);
    console.log('');
    
    // Step 3: Demonstrate parsing queue
    console.log('⚡ Step 3: Enqueuing parsing job...');
    const jobId = await parseQueue.enqueueParseJob(sourceId);
    console.log(`✅ Job enqueued with ID: ${jobId}`);
    
    // Show queue status
    const queueStatus = parseQueue.getQueueStatus();
    console.log(`📊 Queue status: ${queueStatus.queueLength} jobs, processing: ${queueStatus.isProcessing}`);
    console.log('');
    
    // Step 4: Wait and show results
    console.log('⏳ Step 4: Waiting for parsing to complete...');
    console.log('(In production, this would be monitored via websockets or polling)');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Check results
    console.log('📊 Step 5: Checking parsing results...');
    const updatedSource = await db.select()
      .from(restaurantSchema.restaurantMenuSources)
      .where(eq(restaurantSchema.restaurantMenuSources.id, sourceId))
      .then(r => r[0]);
    
    console.log(`Status: ${updatedSource.status}`);
    if (updatedSource.errorMessage) {
      console.log(`Error: ${updatedSource.errorMessage}`);
    }
    if (updatedSource.confidence) {
      console.log(`Confidence: ${updatedSource.confidence}%`);
    }
    console.log('');
    
    // Show final database state
    console.log('🎯 Final Database State:');
    await showDatabaseCounts();
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

async function showDatabaseCounts() {
  const db = await getDatabase();
  
  const userCount = await db.select().from(userSchema.users).then(r => r.length);
  const restaurantCount = await db.select().from(restaurantSchema.restaurants).then(r => r.length);
  const sourceCount = await db.select().from(restaurantSchema.restaurantMenuSources).then(r => r.length);
  
  console.log(`   👥 ${userCount} users`);
  console.log(`   🏪 ${restaurantCount} restaurants`);
  console.log(`   🔗 ${sourceCount} menu sources`);
}

// Import missing dependencies
import { eq } from 'drizzle-orm';

// Run the demo
demoApiWorkflow().then(() => {
  console.log('\n✅ API workflow demo completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Demo crashed:', error);
  process.exit(1);
});