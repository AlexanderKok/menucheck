import { getDatabase } from '../lib/db';
import * as restaurantSchema from '../schema/restaurants';
import * as menuSchema from '../schema/menus';
import { eq, and } from 'drizzle-orm';
import { urlParser } from './urlParser';
import type { ParseJob, RestaurantMenuSourceData } from '../types/url-parsing';

export class ParseQueue {
  private isProcessing = false;
  private queue: ParseJob[] = [];
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start processing queue every 10 seconds
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 10000);
  }

  /**
   * Add a new URL parsing job to the queue
   */
  async enqueueParseJob(restaurantMenuSourceId: string): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ParseJob = {
      id: jobId,
      restaurantMenuSourceId,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0
    };

    this.queue.push(job);
    
    // Try to process immediately if not already processing
    if (!this.isProcessing) {
      setImmediate(() => this.processQueue());
    }

    return jobId;
  }

  /**
   * Process jobs in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[ParseQueue] Processing ${this.queue.length} jobs in queue`);

    try {
      // Process jobs one at a time to avoid overwhelming the system
      const job = this.queue.shift();
      if (job) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('[ParseQueue] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single parsing job
   */
  private async processJob(job: ParseJob): Promise<void> {
    try {
      console.log(`[ParseQueue] Processing job ${job.id} for source ${job.restaurantMenuSourceId}`);
      
      job.status = 'processing';
      job.startedAt = new Date();

      const db = await getDatabase();
      
      // Get the restaurant menu source
      const sources = await db.select()
        .from(restaurantSchema.restaurantMenuSources)
        .where(eq(restaurantSchema.restaurantMenuSources.id, job.restaurantMenuSourceId))
        .limit(1);

      if (!sources.length) {
        throw new Error(`Restaurant menu source ${job.restaurantMenuSourceId} not found`);
      }

      const source = sources[0];
      
      // Update source status to processing
      await db.update(restaurantSchema.restaurantMenuSources)
        .set({ 
          status: 'processing',
          lastAttemptedAt: new Date()
        })
        .where(eq(restaurantSchema.restaurantMenuSources.id, source.id));

      // Detect document type and strategy
      const { sourceType, documentType, strategy } = await urlParser.detectDocumentType(source.url);
      
      // Update source with detected type
      await db.update(restaurantSchema.restaurantMenuSources)
        .set({ 
          sourceType,
          documentType
        })
        .where(eq(restaurantSchema.restaurantMenuSources.id, source.id));

      // Parse the URL
      const parseResult = await urlParser.parseUrl(source.url, strategy);

      if (parseResult.success && parseResult.menuItems.length > 0) {
        // Create menu upload record
        const menuId = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const menuData = {
          id: menuId,
          userId: source.userId,
          restaurantId: source.restaurantId,
          fileName: null,
          originalFileName: null,
          fileSize: null,
          mimeType: null,
          fileUrl: source.url,
          sourceUrl: source.url,
          parseMethod: parseResult.parseMethod,
          status: 'completed' as const,
          totalItems: parseResult.menuItems.length,
          avgPrice: this.calculateAveragePrice(parseResult.menuItems),
          minPrice: this.calculateMinPrice(parseResult.menuItems),
          maxPrice: this.calculateMaxPrice(parseResult.menuItems),
          // Calculate basic scores based on available data
          // ⚠️  CRITICAL: These scoring algorithms are MVP implementations that WILL need refinement
          // after feeding real training data. Known issues: outliers, parsing errors, cultural differences.
          // See individual method comments for specific concerns.
          profitabilityScore: this.calculateProfitabilityScore(parseResult.menuItems),
          readabilityScore: Math.floor(parseResult.confidence),
          pricingOptimizationScore: this.calculatePricingScore(parseResult.menuItems),
          categoryBalanceScore: this.calculateCategoryBalanceScore(parseResult.categories, parseResult.menuItems),
          processingStartedAt: job.startedAt,
          processingCompletedAt: new Date(),
          analysisData: {
            categories: parseResult.categories,
            menuItems: parseResult.menuItems,
            parseMethod: parseResult.parseMethod,
            confidence: parseResult.confidence
          }
        };

        await db.insert(menuSchema.menuUploads).values(menuData);

        // Create menu categories and build category mapping
        const categoryMap: Record<string, string> = {};
        for (const categoryName of parseResult.categories) {
          const categoryId = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const categoryItems = parseResult.menuItems.filter(item => 
            item.category === categoryName || 
            (item.name.toLowerCase().includes(categoryName.toLowerCase()) && item.category === undefined)
          );

          await db.insert(menuSchema.menuCategories).values({
            id: categoryId,
            menuId,
            name: categoryName,
            itemCount: categoryItems.length,
            avgPrice: categoryItems.length > 0 ? 
              (categoryItems.reduce((sum, item) => sum + item.price, 0) / categoryItems.length).toString() : '0'
          });

          categoryMap[categoryName] = categoryId;
        }

        // Create menu items with proper category linking
        for (const item of parseResult.menuItems) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Find the appropriate category ID
          let categoryId = null;
          if (item.category && categoryMap[item.category]) {
            categoryId = categoryMap[item.category];
          } else {
            // Try to match by category name in the item name
            for (const [categoryName, catId] of Object.entries(categoryMap)) {
              if (item.name.toLowerCase().includes(categoryName.toLowerCase())) {
                categoryId = catId;
                break;
              }
            }
          }

          await db.insert(menuSchema.menuItems).values({
            id: itemId,
            menuId,
            categoryId,
            name: item.name,
            description: item.description,
            price: item.price.toString(), // Keep as string since Drizzle decimal fields expect string input
            currency: item.currency,
            prominence: item.prominence,
            position: null
          });
        }

        // Update source as completed
        await db.update(restaurantSchema.restaurantMenuSources)
          .set({ 
            status: 'completed',
            successfullyParsedAt: new Date(),
            parseMethod: parseResult.parseMethod,
            confidence: parseResult.confidence.toString()
          })
          .where(eq(restaurantSchema.restaurantMenuSources.id, source.id));

        console.log(`[ParseQueue] Successfully processed job ${job.id} - extracted ${parseResult.menuItems.length} items`);

      } else {
        // Parsing failed
        await db.update(restaurantSchema.restaurantMenuSources)
          .set({ 
            status: 'failed',
            errorMessage: parseResult.errorMessage || 'Failed to extract menu items'
          })
          .where(eq(restaurantSchema.restaurantMenuSources.id, source.id));

        console.log(`[ParseQueue] Job ${job.id} failed: ${parseResult.errorMessage}`);
      }

      job.status = 'completed';
      job.completedAt = new Date();

    } catch (error) {
      console.error(`[ParseQueue] Job ${job.id} failed with error:`, error);
      
      job.status = 'failed';
      job.retryCount++;
      job.completedAt = new Date();

      // Update source as failed
      try {
        const db = await getDatabase();
        await db.update(restaurantSchema.restaurantMenuSources)
          .set({ 
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
          })
          .where(eq(restaurantSchema.restaurantMenuSources.id, job.restaurantMenuSourceId));
      } catch (dbError) {
        console.error('[ParseQueue] Failed to update source status:', dbError);
      }

      // Retry failed jobs up to 3 times
      if (job.retryCount < 3) {
        console.log(`[ParseQueue] Retrying job ${job.id} (attempt ${job.retryCount + 1})`);
        job.status = 'pending';
        job.completedAt = undefined;
        this.queue.push(job);
      }
    }
  }

  /*
   * ════════════════════════════════════════════════════════════════════════════════════════
   * 🚨 DATA QUALITY & SCORING SYSTEM WARNINGS FOR FUTURE DEVELOPERS 🚨
   * ════════════════════════════════════════════════════════════════════════════════════════
   * 
   * The scoring algorithms below are MVP implementations designed to provide baseline analytics.
   * They WILL produce incorrect/misleading results in many real-world scenarios until refined.
   * 
   * EXPECTED FAILURE MODES WITH REAL DATA:
   * 
   * 1. 💰 PRICE OUTLIERS:
   *    - €2 coffee vs €45 seafood platter vs €0.50 bread will skew all price-based metrics
   *    - "Family meal for 4: €60" parsed as single item destroys averages
   *    - Wine bottles (€25-200) mixed with food items (€8-25) creates false ranges
   * 
   * 2. 🔧 PARSING ERRORS:
   *    - "€12.50 per person" → "€12.50" (missing context) or "€1250" (decimal fail)
   *    - "Market price" → €0 or parsing failure
   *    - "€8-12" → €8 or €12 or €812 depending on parsing logic
   *    - HTML artifacts: "€12<sup>.50</sup>" → "€12.50" vs "€1250"
   * 
   * 3. 🌍 CULTURAL/LINGUISTIC ISSUES:
   *    - French "Entrées" ≠ English "Entrees" ≠ appetizers
   *    - German "Hauptgang" won't match "mains" category detection
   *    - Asian restaurants: 12 dim sum types vs 3 western categories
   *    - "Tapas" naturally has 15+ small categories vs "burger joint" with 4
   * 
   * 4. 🍽️  MENU STRUCTURE VARIATIONS:
   *    - Fast food: Burgers, Fries, Drinks (3 cats) vs Fine dining: 8+ categories
   *    - Sushi: Sashimi, Rolls, Appetizers (3-5 cats) vs Italian: 6-8 categories
   *    - Brewery: 20 beer types + 5 food items = distribution chaos
   * 
   * 5. 📊 STATISTICAL ASSUMPTIONS:
   *    - Assumes normal price distribution (reality: heavily skewed)
   *    - Variance calculations broken by single outliers
   *    - No consideration of item popularity/sales volume
   * 
   * IMMEDIATE FIXES NEEDED AFTER TRAINING DATA:
   * - Implement robust outlier detection (IQR method, z-score)
   * - Add category-aware scoring (drinks ≠ mains pricing)
   * - Price validation (flag €0, €500+, negative values)
   * - Multilingual category normalization
   * - Restaurant type classification for contextual scoring
   * 
   * ════════════════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Calculate average price from menu items
   */
  private calculateAveragePrice(items: any[]): string {
    if (items.length === 0) return '0';
    const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
    return (total / items.length).toFixed(2);
  }

  /**
   * Calculate minimum price from menu items
   */
  private calculateMinPrice(items: any[]): string {
    if (items.length === 0) return '0';
    return Math.min(...items.map(item => item.price || 0)).toFixed(2);
  }

  /**
   * Calculate maximum price from menu items
   */
  private calculateMaxPrice(items: any[]): string {
    if (items.length === 0) return '0';
    return Math.max(...items.map(item => item.price || 0)).toFixed(2);
  }

  /**
   * Calculate basic profitability score based on price distribution
   * 
   * ⚠️  KNOWN ISSUES TO ADDRESS WITH TRAINING DATA:
   * 1. OUTLIER SENSITIVITY: €2 drinks vs €45 sharing platters will skew scores
   * 2. CATEGORY BLINDNESS: Doesn't distinguish between appetizers vs mains pricing
   * 3. PARSING ERRORS: Misread "€12.50 for 2" as "€12502" will break calculations
   * 4. CURRENCY MIXING: Mixed USD/EUR in same menu could cause issues
   * 5. PORTION SIZE IGNORANCE: "Family platter €35" vs "Single dish €15" treated equally
   * 
   * TODO: Implement outlier detection (IQR method) and category-aware scoring
   * TODO: Add price validation and error handling for extreme values
   * TODO: Consider weighted scoring by item category (mains > appetizers > drinks)
   */
  private calculateProfitabilityScore(items: any[]): number {
    if (items.length === 0) return 50;
    
    const prices = items.map(item => item.price || 0);
    // TODO: Add outlier filtering here - remove prices beyond 1.5*IQR from median
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    // Basic scoring based on price range and distribution
    const priceRange = maxPrice - minPrice;
    const priceRangeScore = Math.min(priceRange / avgPrice * 20, 40); // 0-40 points
    // ⚠️  WARNING: Large outliers (€2 vs €50) will inflate this score artificially
    
    // Favor menus with good price distribution (not all same price)
    const varietyScore = prices.length > 5 ? 30 : prices.length * 6; // 0-30 points
    
    // Bonus for higher average prices (potential profit)
    const avgPriceScore = Math.min(avgPrice * 2, 30); // 0-30 points
    // ⚠️  WARNING: Cheap drinks (€3) will artificially lower this, expensive platters will inflate it
    
    return Math.floor(Math.min(priceRangeScore + varietyScore + avgPriceScore, 100));
  }

  /**
   * Calculate pricing optimization score based on price patterns
   * 
   * ⚠️  KNOWN ISSUES TO ADDRESS WITH TRAINING DATA:
   * 1. PARSING ERRORS: "€12.50 per person" parsed as "€12.50" vs "€1250" corrupts decimal analysis
   * 2. CONTEXT IGNORANCE: €2.99 drinks vs €29.90 mains - both trigger .99 logic equally
   * 3. ROUNDING ERRORS: Floating point arithmetic may miss .99 endings due to precision
   * 4. CURRENCY FORMATS: European "€12,50" vs American "€12.50" decimal handling
   * 5. FALSE POSITIVES: Accidentally parsed prices like "€123.45" aren't psychological pricing
   * 
   * TODO: Add category-aware psychological pricing (drinks vs mains vs desserts)
   * TODO: Implement price validation to catch parsing errors (e.g., prices > €200 flag for review)
   * TODO: Use decimal.js or similar for precise decimal arithmetic
   * TODO: Add regional pricing pattern recognition (European comma vs American period)
   */
  private calculatePricingScore(items: any[]): number {
    if (items.length === 0) return 50;
    
    const prices = items.map(item => item.price || 0);
    // TODO: Filter out likely parsing errors (prices > €100 or < €1 should be flagged)
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // Check for psychological pricing (prices ending in .99, .95, etc.)
    const psychPricingCount = prices.filter(price => {
      const decimal = price % 1;
      // ⚠️  WARNING: Floating point precision issues may cause .99 to register as .9899999
      return Math.abs(decimal - 0.99) < 0.01 || Math.abs(decimal - 0.95) < 0.01 || Math.abs(decimal - 0.90) < 0.01;
    }).length;
    
    const psychPricingScore = (psychPricingCount / prices.length) * 40; // 0-40 points
    
    // Check for round numbers (good for premium items)
    const roundPricingCount = prices.filter(price => price % 1 === 0).length;
    const roundPricingScore = Math.min((roundPricingCount / prices.length) * 30, 20); // 0-20 points
    
    // Baseline score
    const baseScore = 40;
    
    return Math.floor(Math.min(baseScore + psychPricingScore + roundPricingScore, 100));
  }

  /**
   * Calculate category balance score based on category distribution
   * 
   * ⚠️  KNOWN ISSUES TO ADDRESS WITH TRAINING DATA:
   * 1. PARSING FAILURES: "Starters & Salads" might be split into "Starters" + "Salads" artificially
   * 2. LANGUAGE BARRIERS: French "Entrées" vs English "Entrees" vs German "Vorspeisen" not recognized
   * 3. CATEGORY MISCLASSIFICATION: "Wine by the Glass" vs "Beverages" - semantic duplicates
   * 4. RESTAURANT TYPE BLINDNESS: Fast food (3 categories) vs fine dining (8 categories) scored equally
   * 5. CULTURAL CONTEXT: "Tapas" menus naturally have 12+ categories, "Sushi" has fewer
   * 6. PARSING INCONSISTENCY: Some items may not get categories assigned, skewing distribution
   * 
   * TODO: Add restaurant type awareness (fast food vs fine dining have different ideal counts)
   * TODO: Implement multilingual category recognition and normalization
   * TODO: Add semantic similarity detection to merge duplicate categories
   * TODO: Handle uncategorized items in distribution calculations
   * TODO: Add cultural/cuisine-specific category patterns (Asian vs European vs American)
   */
  private calculateCategoryBalanceScore(categories: string[], items: any[]): number {
    if (categories.length === 0 || items.length === 0) return 50;
    
    // Ideal number of categories for a restaurant menu
    const idealCategoryCount = 6; // ⚠️  WARNING: This assumes typical European casual dining
    const categoryScore = Math.max(0, 40 - Math.abs(categories.length - idealCategoryCount) * 5);
    
    // Check distribution of items across categories
    const itemsPerCategory = categories.map(category => 
      items.filter(item => item.category === category).length
    );
    // TODO: Account for items with no category assigned (item.category === null/undefined)
    
    const avgItemsPerCategory = items.length / categories.length;
    const variance = itemsPerCategory.reduce((sum, count) => 
      sum + Math.pow(count - avgItemsPerCategory, 2), 0
    ) / categories.length;
    
    // Lower variance = better distribution
    const distributionScore = Math.max(0, 40 - variance);
    // ⚠️  WARNING: High variance might be normal for specialized restaurants (tapas, sushi)
    
    // Bonus for having main course categories
    const mainCategories = ['appetizers', 'mains', 'entrees', 'desserts', 'beverages'];
    // TODO: Add multilingual support: 'antipasti', 'hauptgänge', 'desserts', 'getränke', etc.
    const hasMainCategories = categories.some(cat => 
      mainCategories.some(main => cat.toLowerCase().includes(main.toLowerCase()))
    );
    const mainCategoryBonus = hasMainCategories ? 20 : 0;
    // ⚠️  WARNING: Non-English menus will miss this bonus entirely
    
    return Math.floor(Math.min(categoryScore + distributionScore + mainCategoryBonus, 100));
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      pendingJobs: this.queue.filter(job => job.status === 'pending').length,
      processingJobs: this.queue.filter(job => job.status === 'processing').length
    };
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }
}

// Export singleton instance
export const parseQueue = new ParseQueue();