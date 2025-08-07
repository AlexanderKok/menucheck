import type { ParsedMenuItem, MenuItemProminence } from '../../types/url-parsing';

export interface RawMenuItem {
  text: string;
  price?: string;
  element?: any; // DOM element for HTML parsing
  styling?: any; // CSS styles or formatting info
  position?: { x: number; y: number };
}

export class MenuItemExtractor {
  /**
   * Extract menu items from parsed content
   */
  extractMenuItems(content: RawMenuItem[], contentType: 'html' | 'pdf' | 'text'): ParsedMenuItem[] {
    const items: ParsedMenuItem[] = [];
    
    for (const rawItem of content) {
      const extracted = this.extractSingleItem(rawItem, contentType);
      if (extracted) {
        items.push(extracted);
      }
    }
    
    return this.deduplicateItems(items);
  }
  
  /**
   * Extract a single menu item from raw content
   */
  private extractSingleItem(rawItem: RawMenuItem, contentType: string): ParsedMenuItem | null {
    try {
      const { name, description, price } = this.parseItemText(rawItem.text);
      
      if (!name || !price) {
        return null;
      }
      
      const prominence = this.detectProminence(rawItem, contentType);
      
      return {
        name: this.cleanItemName(name),
        description: description ? this.cleanDescription(description) : undefined,
        price: this.parsePrice(price),
        currency: this.detectCurrency(price) || 'EUR',
        prominence
      };
    } catch (error) {
      console.error('Error extracting menu item:', error);
      return null;
    }
  }
  
  /**
   * Parse item text to extract name, description, and price
   */
  private parseItemText(text: string): { name?: string; description?: string; price?: string } {
    // Common patterns for menu items
    const patterns = [
      // Pattern 1: Name - Description ... Price
      /^(.+?)\s*[-–—]\s*(.+?)\s*[.\s]+\$?(\d+(?:\.\d{2})?)/,
      
      // Pattern 2: Name ... Price (Description)
      /^(.+?)\s*[.\s]+\$?(\d+(?:\.\d{2})?)\s*\((.+?)\)/,
      
      // Pattern 3: Name (Description) ... Price
      /^(.+?)\s*\((.+?)\)\s*[.\s]+\$?(\d+(?:\.\d{2})?)/,
      
      // Pattern 4: Name ... Price
      /^(.+?)\s*[.\s]+\$?(\d+(?:\.\d{2})?)\s*$/,
      
      // Pattern 5: Name Price (at end)
      /^(.+?)\s+\$?(\d+(?:\.\d{2})?)\s*$/,
      
      // Pattern 6: Price at start
      /^\$?(\d+(?:\.\d{2})?)\s+(.+)$/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern === patterns[5]) { // Price at start
          return {
            name: match[2],
            price: match[1]
          };
        } else if (pattern === patterns[0] || pattern === patterns[2]) { // Has description
          return {
            name: match[1],
            description: match[2],
            price: match[3]
          };
        } else if (pattern === patterns[1]) { // Price before description
          return {
            name: match[1],
            description: match[3],
            price: match[2]
          };
        } else { // Just name and price
          return {
            name: match[1],
            price: match[2]
          };
        }
      }
    }
    
    // Fallback: try to extract price from anywhere in the text
    const priceMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      const price = priceMatch[1];
      const nameText = text.replace(priceMatch[0], '').trim();
      if (nameText) {
        return {
          name: nameText,
          price
        };
      }
    }
    
    return {};
  }
  
  /**
   * Detect visual prominence indicators
   */
  detectProminence(rawItem: RawMenuItem, contentType: string): MenuItemProminence {
    const prominence: MenuItemProminence = {
      confidenceScore: 50 // Default confidence
    };
    
    if (contentType === 'html' && rawItem.element) {
      // Analyze HTML element for prominence
      prominence.fontSize = this.detectFontSize(rawItem.element);
      prominence.hasSpecialIcon = this.detectSpecialIcons(rawItem.element);
      prominence.iconType = this.detectIconType(rawItem.element);
      prominence.hasVisualBox = this.detectVisualBox(rawItem.element);
      prominence.isHighlighted = this.detectHighlighting(rawItem.element);
      prominence.position = rawItem.position;
      
      // Increase confidence for HTML parsing
      prominence.confidenceScore = 75;
    } else if (contentType === 'pdf' && rawItem.styling) {
      // Analyze PDF styling for prominence
      prominence.fontSize = this.detectPdfFontSize(rawItem.styling);
      prominence.hasVisualBox = this.detectPdfBox(rawItem.styling);
      prominence.isHighlighted = this.detectPdfHighlighting(rawItem.styling);
      prominence.position = rawItem.position;
      
      // Confidence varies based on PDF type
      prominence.confidenceScore = 60;
    }
    
    return prominence;
  }
  
  /**
   * Standardize price format
   */
  private parsePrice(priceText: string): number {
    // Remove currency symbols and whitespace
    const cleanPrice = priceText.replace(/[$£€¥₹,\s]/g, '');
    
    // Handle price ranges (take the first price)
    const rangeMatch = cleanPrice.match(/^(\d+(?:\.\d{2})?)/);
    if (rangeMatch) {
      return parseFloat(rangeMatch[1]);
    }
    
    return parseFloat(cleanPrice) || 0;
  }
  
  /**
   * Detect currency from price text
   */
  private detectCurrency(priceText: string): string | null {
    // Prioritize EU currencies for EU-focused application
    const currencySymbols: { [key: string]: string } = {
      '€': 'EUR',      // Euro - highest priority for EU market
      '£': 'GBP',      // British Pound
      'CHF': 'CHF',    // Swiss Franc
      'SEK': 'SEK',    // Swedish Krona
      'NOK': 'NOK',    // Norwegian Krone
      'DKK': 'DKK',    // Danish Krone
      'PLN': 'PLN',    // Polish Zloty
      'CZK': 'CZK',    // Czech Koruna
      'HUF': 'HUF',    // Hungarian Forint
      '$': 'USD',      // US Dollar
      '¥': 'JPY',      // Japanese Yen
      '₹': 'INR',      // Indian Rupee
      '₽': 'RUB',      // Russian Ruble
      '₩': 'KRW',      // Korean Won
      '¢': 'USD',      // Cents
      'C$': 'CAD',     // Canadian Dollar
      'A$': 'AUD',     // Australian Dollar
      'NZ$': 'NZD',    // New Zealand Dollar
      'S$': 'SGD',     // Singapore Dollar
      'HK$': 'HKD',    // Hong Kong Dollar
      'R$': 'BRL',     // Brazilian Real
      'MX$': 'MXN'     // Mexican Peso
    };
    
    // Check for currency codes first (e.g., "USD 15.99", "15.99 EUR")
    const currencyCodePattern = /\b([A-Z]{3})\b/g;
    const codeMatch = priceText.match(currencyCodePattern);
    if (codeMatch) {
      const code = codeMatch[0];
      if (Object.values(currencySymbols).includes(code)) {
        return code;
      }
    }
    
    // Check for currency symbols
    for (const symbol of Object.keys(currencySymbols)) {
      if (priceText.includes(symbol)) {
        return currencySymbols[symbol];
      }
    }
    
    return null;
  }
  
  /**
   * Clean and standardize item names
   */
  private cleanItemName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[.\-\s]+|[.\-\s]+$/g, '') // Remove leading/trailing dots, dashes, spaces
      .split(/[.]{3,}/)[0] // Remove dot leaders
      .trim();
  }
  
  /**
   * Clean description text
   */
  private cleanDescription(description: string): string {
    return description
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
      .trim();
  }
  
  /**
   * Remove duplicate items based on name similarity
   */
  private deduplicateItems(items: ParsedMenuItem[]): ParsedMenuItem[] {
    const unique: ParsedMenuItem[] = [];
    
    for (const item of items) {
      const isDuplicate = unique.some(existing => 
        this.calculateSimilarity(existing.name, item.name) > 0.8
      );
      
      if (!isDuplicate) {
        unique.push(item);
      }
    }
    
    return unique;
  }
  
  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  // HTML-specific prominence detection methods
  private detectFontSize(element: any): 'small' | 'medium' | 'large' | 'xlarge' {
    // Implementation would check computed styles, class names, etc.
    return 'medium'; // Placeholder
  }
  
  private detectSpecialIcons(element: any): boolean {
    // Check for icons, emojis, special characters
    return false; // Placeholder
  }
  
  private detectIconType(element: any): string | undefined {
    // Analyze icon types based on classes, alt text, etc.
    return undefined; // Placeholder
  }
  
  private detectVisualBox(element: any): boolean {
    // Check for borders, background colors, etc.
    return false; // Placeholder
  }
  
  private detectHighlighting(element: any): boolean {
    // Check for highlighted styles
    return false; // Placeholder
  }
  
  // PDF-specific prominence detection methods
  private detectPdfFontSize(styling: any): 'small' | 'medium' | 'large' | 'xlarge' {
    // Analyze PDF font size information
    return 'medium'; // Placeholder
  }
  
  private detectPdfBox(styling: any): boolean {
    // Check for PDF box elements
    return false; // Placeholder
  }
  
  private detectPdfHighlighting(styling: any): boolean {
    // Check for PDF highlighting
    return false; // Placeholder
  }
  
  /**
   * Categorize menu items using keyword matching
   */
  categorizeMenuItem(item: ParsedMenuItem): string | undefined {
    const categories = {
      'Appetizers': ['appetizer', 'starter', 'small plate', 'sharing', 'antipasti', 'tapas'],
      'Soups & Salads': ['soup', 'salad', 'bowl', 'broth', 'chowder', 'bisque'],
      'Main Courses': ['main', 'entree', 'entrée', 'pasta', 'pizza', 'burger', 'steak', 'chicken', 'fish', 'seafood'],
      'Desserts': ['dessert', 'sweet', 'cake', 'ice cream', 'gelato', 'tart', 'pie', 'chocolate'],
      'Beverages': ['drink', 'beverage', 'coffee', 'tea', 'juice', 'soda', 'wine', 'beer', 'cocktail']
    };
    
    const itemText = `${item.name} ${item.description || ''}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => itemText.includes(keyword))) {
        return category;
      }
    }
    
    return undefined;
  }
}

export const menuItemExtractor = new MenuItemExtractor();