import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { getDatabase } from '../lib/db';
import * as restaurantSchema from '../schema/restaurants';

interface RestaurantCSVRow {
  id: string;
  restaurant_name: string;
  website_url: string;
  city: string;
  country: string;
  cuisine_type: string;
  price_range: string;
  rating: string;
  review_count: string;
  address: string;
  phone: string;
  latitude: string;
  longitude: string;
  menu_url_count: string;
  menu_urls: string;
  menu_types: string;
  best_extraction_confidence: string;
  total_items_extracted: string;
  last_crawled: string;
  data_source: string;
  has_menu_data: string;
  export_date: string;
}

async function loadTestData() {
  try {
    console.log('Loading test restaurant data...');
    
    // Read CSV file
    const csvPath = '/Users/alexanderkok/KaartKompas/docs/temp_files/combined_restaurants_20250806_200450.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const rows: RestaurantCSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`Found ${rows.length} restaurants in CSV`);
    
    const db = await getDatabase();
    
    // Process first 40 restaurants as specified in the plan
    const testRestaurants = rows.slice(0, 40);
    
    for (const row of testRestaurants) {
      try {
        const restaurantId = `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Extract menu URLs
        const menuUrls = row.menu_urls ? row.menu_urls.split(';').map(url => url.trim()).filter(url => url) : [];
        
        // Clean cuisine type
        const cuisineType = row.cuisine_type && row.cuisine_type !== 'Unknown' ? row.cuisine_type : null;
        
        // Create restaurant record
        const restaurantData = {
          id: restaurantId,
          userId: 'test_user_csv_import', // Default user for CSV imported restaurants
          name: row.restaurant_name,
          url: row.website_url,
          address: row.address || null,
          city: row.city,
          country: row.country,
          latitude: row.latitude ? row.latitude : null,
          longitude: row.longitude ? row.longitude : null,
          restaurantType: null, // Not provided in CSV
          cuisines: cuisineType ? [cuisineType] : null,
          phoneNumber: row.phone || null,
          description: `Restaurant from ${row.data_source} with ${row.total_items_extracted} menu items extracted`,
        };
        
        await db.insert(restaurantSchema.restaurants).values(restaurantData);
        console.log(`✓ Created restaurant: ${row.restaurant_name}`);
        
        // Create restaurant menu sources for each menu URL
        for (let i = 0; i < Math.min(menuUrls.length, 5); i++) { // Limit to 5 URLs per restaurant
          const menuUrl = menuUrls[i];
          if (!menuUrl || menuUrl.length < 10) continue; // Skip invalid URLs
          
          const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Determine source type based on URL
          let sourceType: 'pdf' | 'html' | 'js' = 'html';
          let documentType: string | null = 'html_static';
          
          if (menuUrl.includes('.pdf')) {
            sourceType = 'pdf';
            documentType = 'digital_pdf';
          } else if (menuUrl.includes('#') || menuUrl.includes('javascript') || menuUrl.includes('react') || menuUrl.includes('vue')) {
            sourceType = 'js';
            documentType = 'html_dynamic';
          }
          
          const sourceData = {
            id: sourceId,
            restaurantId: restaurantId,
            userId: 'test_user_id', // Placeholder user ID for testing
            url: menuUrl,
            sourceType,
            documentType,
            status: 'pending' as const,
            errorMessage: null,
            lastAttemptedAt: null,
            successfullyParsedAt: null,
            parseMethod: null,
            confidence: row.best_extraction_confidence ? row.best_extraction_confidence : null,
          };
          
          await db.insert(restaurantSchema.restaurantMenuSources).values(sourceData);
          console.log(`  ✓ Added menu source: ${menuUrl.substring(0, 60)}...`);
        }
        
      } catch (error) {
        console.error(`Error processing restaurant ${row.restaurant_name}:`, error);
      }
    }
    
    console.log(`\n✅ Successfully loaded ${testRestaurants.length} test restaurants`);
    console.log('Use the following query to view loaded data:');
    console.log('SELECT r.name, COUNT(s.id) as menu_sources FROM restaurants r LEFT JOIN restaurant_menu_sources s ON r.id = s.restaurant_id GROUP BY r.id, r.name LIMIT 10;');
    
  } catch (error) {
    console.error('Error loading test data:', error);
  }
}

// Run the script
loadTestData().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});