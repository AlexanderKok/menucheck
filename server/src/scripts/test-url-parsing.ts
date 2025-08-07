import { getDatabase } from '../lib/db';
import * as restaurantSchema from '../schema/restaurants';
import { eq, and } from 'drizzle-orm';
import { urlParser } from '../services/urlParser';
import { parseQueue } from '../services/parseQueue';

async function testUrlParsing() {
  try {
    console.log('🧪 Testing URL-based menu parsing...\n');
    
    const db = await getDatabase();
    
    // Get first 5 restaurant menu sources for testing
    const testSources = await db.select()
      .from(restaurantSchema.restaurantMenuSources)
      .where(eq(restaurantSchema.restaurantMenuSources.status, 'pending'))
      .limit(5);
    
    if (testSources.length === 0) {
      console.log('❌ No pending restaurant menu sources found. Run load-test-data.ts first.');
      return;
    }
    
    console.log(`📋 Found ${testSources.length} test sources to parse:\n`);
    
    for (const source of testSources) {
      console.log(`🔍 Testing URL: ${source.url}`);
      console.log(`   Restaurant ID: ${source.restaurantId}`);
      console.log(`   Source Type: ${source.sourceType}`);
      
      try {
        // Test document type detection
        console.log('   📊 Detecting document type...');
        const detection = await urlParser.detectDocumentType(source.url);
        console.log(`   ✓ Detected: ${detection.sourceType}/${detection.documentType} -> ${detection.strategy}`);
        
        // Test URL validation
        console.log('   🔗 Validating URL...');
        const isValid = await urlParser.validateRestaurantUrl(source.url);
        console.log(`   ${isValid ? '✓' : '❌'} URL is ${isValid ? 'valid' : 'invalid'}`);
        
        if (isValid) {
          // Test parsing (with timeout to avoid hanging)
          console.log('   🍽️  Attempting to parse menu...');
          const parsePromise = urlParser.parseUrl(source.url, detection.strategy);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Parsing timeout')), 10000)
          );
          
          try {
            const result = await Promise.race([parsePromise, timeoutPromise]);
            console.log(`   ${result.success ? '✅' : '❌'} Parse ${result.success ? 'successful' : 'failed'}`);
            
            if (result.success) {
              console.log(`   📊 Found ${result.menuItems.length} menu items`);
              console.log(`   📚 Found ${result.categories.length} categories`);
              console.log(`   🎯 Confidence: ${result.confidence}%`);
              console.log(`   🔧 Parse method: ${result.parseMethod}`);
              
              // Show sample menu items
              if (result.menuItems.length > 0) {
                console.log('   📝 Sample items:');
                result.menuItems.slice(0, 3).forEach((item, index) => {
                  console.log(`      ${index + 1}. ${item.name} - $${item.price}`);
                  if (item.description) {
                    console.log(`         "${item.description.substring(0, 50)}..."`);
                  }
                });
              }
            } else {
              console.log(`   ❌ Error: ${result.errorMessage}`);
            }
          } catch (error) {
            console.log(`   ⚠️  Parse timeout or error: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Test failed: ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Test queue functionality
    console.log('🔄 Testing parse queue...');
    const queueStatus = parseQueue.getQueueStatus();
    console.log(`   Queue length: ${queueStatus.queueLength}`);
    console.log(`   Is processing: ${queueStatus.isProcessing}`);
    console.log(`   Pending jobs: ${queueStatus.pendingJobs}`);
    
    // Enqueue a test job
    if (testSources.length > 0) {
      console.log('\n⚡ Enqueuing test parsing job...');
      const jobId = await parseQueue.enqueueParseJob(testSources[0].id);
      console.log(`   ✓ Job enqueued with ID: ${jobId}`);
      
      // Wait a moment and check queue status again
      setTimeout(() => {
        const newStatus = parseQueue.getQueueStatus();
        console.log(`   Updated queue status: ${newStatus.queueLength} jobs, processing: ${newStatus.isProcessing}`);
      }, 2000);
    }
    
    console.log('\n✅ URL parsing tests completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Ensure database is running and migrations are applied');
    console.log('   2. Start the development server to test API endpoints');
    console.log('   3. Use the frontend URL upload form to test end-to-end flow');
    
  } catch (error) {
    console.error('❌ Test script failed:', error);
  }
}

// Run the test
testUrlParsing().then(() => {
  console.log('\n🏁 Test script completed');
  // Don't exit immediately to let queue processing show results
  setTimeout(() => process.exit(0), 5000);
}).catch((error) => {
  console.error('💥 Test script crashed:', error);
  process.exit(1);
});