import { APP_CONFIG } from '../constants';
import { CustomerRequest } from '../types';

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- API METHODS ---

/**
 * Registers a new customer request.
 * POST /api/register-customer -> N8N Webhook
 */
export const registerCustomer = async (
  name: string,
  phone: string,
  videoName: string
): Promise<boolean> => {
  if (APP_CONFIG.useMockMode) {
    await delay(800);
    return true;
  } else {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/register-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, videoName }),
      });
      
      if (!response.ok) {
        console.error(`API Error (${response.status}):`, await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error("Network Error", error);
      return false;
    }
  }
};

/**
 * Fetches the list of pending requests.
 * GET /api/get-pending -> N8N Webhook
 */
export const getPendingRequests = async (): Promise<CustomerRequest[]> => {
  if (APP_CONFIG.useMockMode) {
    return [];
  } else {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/get-pending`);
      
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } else {
        console.warn("API Error", await response.text());
        return [];
      }
    } catch (error) {
      console.error("API Error", error);
      return [];
    }
  }
};

/**
 * Uploads a file for a specific customer.
 * POST /api/upload-document -> N8N Webhook
 */
export const uploadDocument = async (
  requestId: string,
  file: File,
  phoneNumber: string
): Promise<boolean> => {
  if (APP_CONFIG.useMockMode) {
    return true;
  } else {
    const formData = new FormData();
    // N8N 'Webhook' node with Binary Data enabled expects the field 'file' by default (or configured name)
    formData.append('file', file);
    
    // N8N will parse these from the body
    formData.append('requestId', requestId);
    formData.append('phoneNumber', phoneNumber);
    formData.append('videoName', file.name);

    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/upload-document`, {
        method: 'POST',
        body: formData, 
      });
      return response.ok;
    } catch (error) {
      console.error("API Error", error);
      return false;
    }
  }
};