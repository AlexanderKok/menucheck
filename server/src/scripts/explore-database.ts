import { getDatabase } from '../lib/db';
import * as schema from '../schema/users';
import * as menuSchema from '../schema/menus';
import * as restaurantSchema from '../schema/restaurants';

async function exploreDatabase() {
  try {
    console.log('🗄️  Exploring Database Schema and Content\n');
    
    const db = await getDatabase();
    
    // Check if we can connect
    console.log('✅ Database connection successful!\n');
    
    // 1. Explore Users Table
    console.log('👥 === USERS TABLE ===');
    try {
      const users = await db.select().from(schema.users).limit(5);
      console.log(`Found ${users.length} users:`);
      users.forEach(user => {
        console.log(`  - ${user.id}: ${user.email} (${user.display_name || 'No name'})`);
      });
    } catch (error) {
      console.log('No users found or table empty');
    }
    console.log('');
    
    // 2. Explore Restaurants Table
    console.log('🏪 === RESTAURANTS TABLE ===');
    try {
      const restaurants = await db.select().from(restaurantSchema.restaurants).limit(5);
      console.log(`Found ${restaurants.length} restaurants:`);
      restaurants.forEach(restaurant => {
        console.log(`  - ${restaurant.name}: ${restaurant.url}`);
        console.log(`    📍 ${restaurant.city}, ${restaurant.country}`);
        console.log(`    🍽️  ${restaurant.cuisines ? restaurant.cuisines.join(', ') : 'No cuisine specified'}`);
      });
    } catch (error) {
      console.log(`No restaurants found: ${error.message}`);
    }
    console.log('');
    
    // 3. Explore Restaurant Menu Sources Table
    console.log('🔗 === RESTAURANT MENU SOURCES TABLE ===');
    try {
      const sources = await db.select().from(restaurantSchema.restaurantMenuSources).limit(5);
      console.log(`Found ${sources.length} menu sources:`);
      sources.forEach(source => {
        console.log(`  - ${source.url}`);
        console.log(`    📊 Type: ${source.sourceType}, Status: ${source.status}`);
        console.log(`    🎯 Confidence: ${source.confidence || 'Not parsed yet'}`);
      });
    } catch (error) {
      console.log(`No menu sources found: ${error.message}`);
    }
    console.log('');
    
    // 4. Explore Menu Uploads Table
    console.log('📄 === MENU UPLOADS TABLE ===');
    try {
      const menus = await db.select().from(menuSchema.menuUploads).limit(5);
      console.log(`Found ${menus.length} menu uploads:`);
      menus.forEach(menu => {
        console.log(`  - ${menu.id}: ${menu.fileName || menu.sourceUrl || 'No name'}`);
        console.log(`    📊 Status: ${menu.status}, Method: ${menu.parseMethod || 'Not parsed'}`);
        console.log(`    🍽️  Items: ${menu.totalItems || 0}, Avg Price: $${menu.avgPrice || '0'}`);
      });
    } catch (error) {
      console.log(`No menu uploads found: ${error.message}`);
    }
    console.log('');
    
    // 5. Explore Menu Items Table
    console.log('🍽️  === MENU ITEMS TABLE ===');
    try {
      const items = await db.select().from(menuSchema.menuItems).limit(10);
      console.log(`Found ${items.length} menu items:`);
      items.forEach(item => {
        console.log(`  - ${item.name}: $${item.price} ${item.currency}`);
        if (item.description) {
          console.log(`    📝 ${item.description.substring(0, 50)}...`);
        }
        if (item.prominence) {
          console.log(`    ⭐ Prominence: ${JSON.stringify(item.prominence)}`);
        }
      });
    } catch (error) {
      console.log(`No menu items found: ${error.message}`);
    }
    console.log('');
    
    // 6. Show Table Schemas
    console.log('🏗️  === DATABASE SCHEMA OVERVIEW ===');
    console.log('Tables created:');
    console.log('  ✅ app.users - User authentication records');
    console.log('  ✅ app.restaurants - Restaurant information & location');
    console.log('  ✅ app.restaurant_menu_sources - URL sources with parsing metadata');
    console.log('  ✅ app.menu_uploads - Processed menu records');
    console.log('  ✅ app.menu_categories - Menu categories extracted from parsing');
    console.log('  ✅ app.menu_items - Individual menu items with prominence data');
    console.log('  ✅ app.menu_recommendations - AI-generated improvement suggestions');
    console.log('');
    
    // 7. Show the complete workflow
    console.log('🔄 === WORKFLOW OVERVIEW ===');
    console.log('1. User submits URL in frontend form');
    console.log('2. POST /api/v1/protected/menus/parse-url creates:');
    console.log('   - Restaurant record in restaurants table');
    console.log('   - Menu upload record in menu_uploads table');
    console.log('   - Menu source record in restaurant_menu_sources table');
    console.log('3. Background queue processor:');
    console.log('   - Detects document type (HTML/PDF/JS)');
    console.log('   - Applies appropriate parsing strategy');
    console.log('   - Extracts menu items with prominence indicators');
    console.log('   - Creates menu_items and menu_categories records');
    console.log('   - Updates status to completed');
    console.log('4. User sees results in MenuInsights dashboard');
    console.log('');
    
    console.log('🎯 === CURRENT STATUS ===');
    
    // Count records in each table
    const userCount = await db.select().from(schema.users).then(r => r.length);
    const restaurantCount = await db.select().from(restaurantSchema.restaurants).then(r => r.length);
    const sourceCount = await db.select().from(restaurantSchema.restaurantMenuSources).then(r => r.length);
    const menuCount = await db.select().from(menuSchema.menuUploads).then(r => r.length);
    const itemCount = await db.select().from(menuSchema.menuItems).then(r => r.length);
    
    console.log(`📊 Database contains:`);
    console.log(`   👥 ${userCount} users`);
    console.log(`   🏪 ${restaurantCount} restaurants`);
    console.log(`   🔗 ${sourceCount} menu sources`);
    console.log(`   📄 ${menuCount} menu uploads`);
    console.log(`   🍽️  ${itemCount} menu items`);
    
  } catch (error) {
    console.error('❌ Database exploration failed:', error);
  }
}

// Run the exploration
exploreDatabase().then(() => {
  console.log('\n✅ Database exploration completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Database exploration crashed:', error);
  process.exit(1);
});