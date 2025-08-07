import { getAuth } from 'firebase/auth';
import { app } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function getAuthToken(): Promise<string | null> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new APIError(
      response.status,
      `API request failed: ${response.statusText}`
    );
  }

  return response;
}

// API endpoints
export async function getCurrentUser() {
  const response = await fetchWithAuth('/api/v1/protected/me');
  return response.json();
}

// Menu Insights API endpoints
export async function uploadMenu(menuData: {
  fileName: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl?: string;
}) {
  const response = await fetchWithAuth('/api/v1/protected/menus/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(menuData),
  });
  return response.json();
}

export async function getUserMenus() {
  const response = await fetchWithAuth('/api/v1/protected/menus');
  return response.json();
}

export async function getMenuAnalysis(menuId: string) {
  const response = await fetchWithAuth(`/api/v1/protected/menus/${menuId}`);
  return response.json();
}

// URL-based menu parsing endpoints
export async function uploadMenuUrl(urlData: {
  url: string;
  restaurant: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    restaurantType?: string;
    cuisines?: string[];
    phoneNumber?: string;
    description?: string;
  };
}) {
  const response = await fetchWithAuth('/api/v1/protected/menus/parse-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(urlData),
  });
  return response.json();
}

// Restaurant management endpoints
export async function createRestaurant(restaurantData: {
  name: string;
  url: string;
  address?: string;
  city?: string;
  country?: string;
  restaurantType?: string;
  cuisines?: string[];
  phoneNumber?: string;
  description?: string;
}) {
  const response = await fetchWithAuth('/api/v1/protected/restaurants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(restaurantData),
  });
  return response.json();
}

export async function getRestaurants() {
  const response = await fetchWithAuth('/api/v1/protected/restaurants');
  return response.json();
}

export async function getRestaurantMenus(restaurantId: string) {
  const response = await fetchWithAuth(`/api/v1/protected/restaurants/${restaurantId}/menus`);
  return response.json();
}

// Consultation API endpoint (public)
export async function submitConsultation(consultationData: {
  restaurantName: string;
  cuisine: string;
  location: string;
  establishedYear?: string;
  contactName: string;
  email: string;
  phone: string;
  seatingCapacity: string;
  serviceType: string[];
  priceRange: string;
  currentChallenges?: string[];
  primaryGoals: string[];
  timeframe: string;
  budget: string;
  additionalNotes?: string;
  marketingConsent?: boolean;
  termsAccepted: boolean;
}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/consultations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(consultationData),
  });

  if (!response.ok) {
    throw new APIError(
      response.status,
      `Consultation submission failed: ${response.statusText}`
    );
  }

  return response.json();
}

export const api = {
  getCurrentUser,
  uploadMenu,
  uploadMenuUrl,
  getUserMenus,
  getMenuAnalysis,
  createRestaurant,
  getRestaurants,
  getRestaurantMenus,
  submitConsultation,
}; 