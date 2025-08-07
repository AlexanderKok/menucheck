import * as cheerio from 'cheerio';
import type { ParseResult } from '../../types/url-parsing';
import { menuItemExtractor, type RawMenuItem } from './menuItemExtractor';

export class HtmlParser {
  /**
   * Parse menu from HTML page
   */
  async parseHtmlMenu(url: string): Promise<ParseResult> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      const $ = cheerio.load(html);
      
      // Detect menu containers
      const menuSelectors = this.detectMenuSelectors($);
      
      if (menuSelectors.length === 0) {
        return {
          success: false,
          menuItems: [],
          categories: [],
          parseMethod: 'html',
          confidence: 0,
          errorMessage: 'No menu content detected on page'
        };
      }
      
      // Extract menu structure from detected containers
      const rawItems = this.extractMenuStructure($, menuSelectors);
      
      // Process raw items into structured menu items
      const menuItems = menuItemExtractor.extractMenuItems(rawItems, 'html');
      
      // Extract categories
      const categories = this.extractCategories($, menuSelectors);
      
      // Calculate confidence based on number of items found and structure quality
      const confidence = this.calculateConfidence(menuItems, categories, rawItems);
      
      return {
        success: menuItems.length > 0,
        menuItems,
        categories,
        parseMethod: 'html',
        confidence,
        documentType: 'html_static'
      };
    } catch (error) {
      console.error('HTML parsing error:', error);
      return {
        success: false,
        menuItems: [],
        categories: [],
        parseMethod: 'html',
        confidence: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown HTML parsing error'
      };
    }
  }
  
  /**
   * Detect menu containers on the page
   */
  private detectMenuSelectors($: cheerio.CheerioAPI): string[] {
    const commonMenuSelectors = [
      // Direct menu selectors
      '.menu',
      '.food-menu',
      '.restaurant-menu',
      '.menu-items',
      '.menu-list',
      '.menu-container',
      '.menu-section',
      '.food-items',
      '.dishes',
      '.food-listing',
      '.menu-content',
      '#menu',
      '#food-menu',
      
      // Menu item containers
      '.menu-item',
      '.food-item',
      '.dish',
      '.menu-entry',
      '.item',
      '.dish-item',
      
      // Menu categories
      '.menu-category',
      '.food-category',
      '.menu-section',
      '.category',
      
      // Generic containers that might contain menus
      '.content',
      '.main-content',
      'main',
      '[data-menu]',
      '[data-food]',
      
      // Lists and tables
      'ul.menu',
      'ol.menu',
      'table.menu',
      '.menu ul',
      '.menu ol',
      '.menu table'
    ];
    
    const foundSelectors: string[] = [];
    
    for (const selector of commonMenuSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        // Check if this selector actually contains menu-like content
        const hasMenuContent = this.hasMenuContent($, elements);
        if (hasMenuContent) {
          foundSelectors.push(selector);
        }
      }
    }
    
    // If no specific menu selectors found, try broader search
    if (foundSelectors.length === 0) {
      const fallbackSelectors = [
        'div:contains("$")', // Elements containing price symbols
        'p:contains("$")',
        'span:contains("$")',
        'li:contains("$")',
        'td:contains("$")'
      ];
      
      for (const selector of fallbackSelectors) {
        try {
          const elements = $(selector);
          if (elements.length > 2) { // At least a few items
            foundSelectors.push(selector);
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
    }
    
    return foundSelectors;
  }
  
  /**
   * Check if elements contain menu-like content
   */
  private hasMenuContent($: cheerio.CheerioAPI, elements: cheerio.Cheerio<any>): boolean {
    let priceCount = 0;
    let itemCount = 0;
    
    elements.each((_, element) => {
      const text = $(element).text();
      
      // Count price indicators
      const priceMatches = text.match(/\$\d+(?:\.\d{2})?/g);
      if (priceMatches) {
        priceCount += priceMatches.length;
      }
      
      // Count potential menu items (lines with food-related keywords)
      const lines = text.split('\n').filter(line => line.trim().length > 5);
      const foodKeywords = ['chicken', 'beef', 'pork', 'fish', 'pasta', 'pizza', 'salad', 'soup', 'sandwich', 'burger'];
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (foodKeywords.some(keyword => lowerLine.includes(keyword)) || priceMatches) {
          itemCount++;
        }
      }
    });
    
    // Consider it menu content if we have at least 3 prices or 5 potential items
    return priceCount >= 3 || itemCount >= 5;
  }
  
  /**
   * Extract menu structure from detected containers
   */
  private extractMenuStructure($: cheerio.CheerioAPI, selectors: string[]): RawMenuItem[] {
    const rawItems: RawMenuItem[] = [];
    
    for (const selector of selectors) {
      const elements = $(selector);
      
      elements.each((_, element) => {
        const $element = $(element);
        
        // Try different extraction strategies
        const items = this.extractFromElement($, $element);
        rawItems.push(...items);
      });
    }
    
    return rawItems;
  }
  
  /**
   * Extract menu items from a single element
   */
  private extractFromElement($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): RawMenuItem[] {
    const items: RawMenuItem[] = [];
    
    // Strategy 1: Look for list items
    const listItems = $element.find('li, tr, .item, .menu-item, .dish, .food-item');
    if (listItems.length > 0) {
      listItems.each((_, item) => {
        const $item = $(item);
        const text = $item.text().trim();
        if (text && this.looksLikeMenuItem(text)) {
          items.push({
            text,
            element: item,
            styling: this.extractStyling($, $item),
            position: this.getElementPosition($, $item)
          });
        }
      });
    }
    
    // Strategy 2: Split by line breaks if no structured items found
    if (items.length === 0) {
      const fullText = $element.text();
      const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 5);
      
      for (const line of lines) {
        if (this.looksLikeMenuItem(line)) {
          items.push({
            text: line,
            element: $element[0],
            styling: this.extractStyling($, $element),
          });
        }
      }
    }
    
    return items;
  }
  
  /**
   * Check if text looks like a menu item
   */
  private looksLikeMenuItem(text: string): boolean {
    // Must contain a price
    const hasPrice = /\$\d+(?:\.\d{2})?/.test(text);
    
    // Should have reasonable length
    const reasonableLength = text.length >= 5 && text.length <= 200;
    
    // Shouldn't be just a price
    const notJustPrice = !/^\s*\$\d+(?:\.\d{2})?\s*$/.test(text);
    
    // Filter out common non-menu text
    const excludePatterns = [
      /copyright/i,
      /all rights reserved/i,
      /terms and conditions/i,
      /privacy policy/i,
      /follow us/i,
      /social media/i,
      /contact/i,
      /phone/i,
      /email/i,
      /address/i
    ];
    
    const notExcluded = !excludePatterns.some(pattern => pattern.test(text));
    
    return hasPrice && reasonableLength && notJustPrice && notExcluded;
  }
  
  /**
   * Extract styling information from element
   */
  private extractStyling($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): any {
    const classes = $element.attr('class') || '';
    const style = $element.attr('style') || '';
    
    return {
      classes: classes.split(' ').filter(c => c.trim()),
      inlineStyle: style,
      tagName: $element.prop('tagName')?.toLowerCase(),
      hasStrongOrBold: $element.find('strong, b, .bold').length > 0,
      hasItalic: $element.find('em, i, .italic').length > 0,
    };
  }
  
  /**
   * Get approximate element position
   */
  private getElementPosition($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): { x: number; y: number } | undefined {
    // This is a simplified position calculation
    // In a real implementation, you might use browser automation to get actual positions
    const parents = $element.parents();
    return {
      x: 0, // Placeholder
      y: parents.length * 20 // Rough estimate based on nesting level
    };
  }
  
  /**
   * Extract menu categories
   */
  private extractCategories($: cheerio.CheerioAPI, selectors: string[]): string[] {
    const categories: Set<string> = new Set();
    
    // Look for headings that might be categories
    const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.category', '.menu-category', '.section-title'];
    
    for (const selector of headingSelectors) {
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        if (text && this.looksLikeCategory(text)) {
          categories.add(text);
        }
      });
    }
    
    // If no categories found, use common ones
    if (categories.size === 0) {
      return ['Appetizers', 'Main Courses', 'Desserts', 'Beverages'];
    }
    
    return Array.from(categories);
  }
  
  /**
   * Check if text looks like a menu category
   */
  private looksLikeCategory(text: string): boolean {
    // Categories are usually short
    if (text.length > 50) return false;
    
    // Shouldn't contain prices
    if (/\$\d+/.test(text)) return false;
    
    // Common category patterns
    const categoryKeywords = [
      'appetizer', 'starter', 'small plate',
      'soup', 'salad',
      'main', 'entree', 'entrée', 'pasta', 'pizza',
      'dessert', 'sweet',
      'beverage', 'drink', 'wine', 'beer', 'cocktail',
      'lunch', 'dinner', 'breakfast',
      'special', 'featured'
    ];
    
    const lowerText = text.toLowerCase();
    return categoryKeywords.some(keyword => lowerText.includes(keyword));
  }
  
  /**
   * Calculate parsing confidence score
   */
  private calculateConfidence(menuItems: any[], categories: string[], rawItems: RawMenuItem[]): number {
    let confidence = 0;
    
    // Base confidence from number of items found
    if (menuItems.length >= 10) confidence += 40;
    else if (menuItems.length >= 5) confidence += 25;
    else if (menuItems.length >= 3) confidence += 15;
    
    // Bonus for having categories
    if (categories.length > 0) confidence += 20;
    
    // Bonus for structured content
    const hasStructuredElements = rawItems.some(item => item.element && item.element.tagName);
    if (hasStructuredElements) confidence += 20;
    
    // Bonus for price consistency
    const pricesFound = menuItems.filter(item => item.price > 0).length;
    const priceRatio = pricesFound / Math.max(menuItems.length, 1);
    confidence += priceRatio * 20;
    
    return Math.min(confidence, 100);
  }
}

/**
 * Main export function for HTML menu parsing
 */
export async function parseHtmlMenu(url: string): Promise<ParseResult> {
  const parser = new HtmlParser();
  return parser.parseHtmlMenu(url);
}