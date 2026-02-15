import { APP_CONFIG } from '../constants';
import { CustomerRequest } from '../types';

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- API METHODS ---

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
      if (!response.ok) return false;
      return true;
    } catch (error) {
      console.error("Network Error", error);
      return false;
    }
  }
};

export const getPendingRequests = async (): Promise<CustomerRequest[]> => {
  if (APP_CONFIG.useMockMode) return [];
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/get-pending`);
    if (response.ok) return await response.json();
    return [];
  } catch (error) {
    console.error("API Error", error);
    return [];
  }
};

export const getFailedRequests = async (): Promise<CustomerRequest[]> => {
  if (APP_CONFIG.useMockMode) return [];
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/get-failed`);
    if (response.ok) return await response.json();
    return [];
  } catch (error) {
    console.error("API Error", error);
    return [];
  }
};

export const uploadDocument = async (
  requestId: string,
  file: File,
  phoneNumber: string
): Promise<boolean> => {
  if (APP_CONFIG.useMockMode) return true;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('requestId', requestId);
  formData.append('phoneNumber', phoneNumber);
  formData.append('videoName', file.name);

  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/upload-document`, {
      method: 'POST',
      body: formData, 
    });
    if (!response.ok) return false;
    return true;
  } catch (error) {
    console.error("Upload Network Error", error);
    return false;
  }
};