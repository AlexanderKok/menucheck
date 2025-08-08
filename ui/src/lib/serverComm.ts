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
  file?: { name: string; size: number; type: string; content: string };
}) {
  const response = await fetchWithAuth('/api/v1/protected/upload-menu', {
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

// Public API endpoints (no authentication required)
export async function uploadPublicMenu(file: File, recaptchaToken: string) {
  // Convert file to base64 for transfer
  const fileContent = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Content = result.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const fileData = {
    name: file.name,
    size: file.size,
    type: file.type,
    content: fileContent
  };

  const response = await fetch(`${API_BASE_URL}/api/v1/public/upload-menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: fileData,
      recaptchaToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      errorData.message || `Public menu upload failed: ${response.statusText}`
    );
  }

  return response.json();
}

export async function parsePublicUrl(url: string, recaptchaToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/parse-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      recaptchaToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      errorData.message || `Public URL parsing failed: ${response.statusText}`
    );
  }

  return response.json();
}

export async function requestPublicReport(restaurantData: {
  uploadId: string;
  restaurantName: string;
  address?: string;
  city?: string;
  country?: string;
  restaurantType?: string;
  cuisines?: string[];
  phoneNumber?: string;
  description?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/request-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(restaurantData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      errorData.message || `Report request failed: ${response.statusText}`
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
  // Public API methods
  uploadPublicMenu,
  parsePublicUrl,
  requestPublicReport,
}; 