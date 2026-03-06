import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Device, MOCK_DEVICES, API_RESPONSE_MOCK } from '@/app/data';

const FUNCTION_URL = `https://${projectId}.supabase.co/functions/v1/make-server-d24c9284`;

// Helper to handle fetch errors gracefully by returning mock data
// Kept for future use if needed, but currently unused to avoid 404s
async function fetchWithFallback<T>(
  url: string, 
  options: RequestInit, 
  fallbackData: T, 
  errorMessage: string
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`API Error [${res.status}]: ${errorMessage} - Using Fallback`);
      throw new Error(`API Error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`Fetch Failed (${url}):`, error);
    // Return fallback data to keep UI functional
    return fallbackData;
  }
}

export async function fetchDevices(): Promise<Device[]> {
  // Return mock data immediately to bypass backend connection issues
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_DEVICES), 500);
  });
}

export async function fetchDevice(id: string): Promise<Device> {
  const mockDevice = MOCK_DEVICES.find(d => d.id === id) || MOCK_DEVICES[0];
  
  // Return mock data immediately to bypass backend connection issues
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockDevice), 200);
  });
}

export async function fetchDeviceHistory(id: string, days: number = 1) {
  // Use the generated 26-hour JSON history if available for this device
  const availableHistory = API_RESPONSE_MOCK.filter(d => d.device === id);
  
  let mockHistory;
  if (availableHistory.length > 0) {
    // Sort by date ascending for charts
    mockHistory = availableHistory
      .sort((a, b) => new Date(a.created_at.$date).getTime() - new Date(b.created_at.$date).getTime())
      .map(h => ({
        timestamp: h.created_at.$date,
        temp_supply_1: h.temp_supply_1,
        return_air: h.return_air,
        relative_humidity: h.relative_humidity === 401 ? 0 : h.relative_humidity,
        ethylene: h.ethylene,
        co2_reading: h.co2_reading === 401 ? null : h.co2_reading,
        set_point: h.set_point,
        alarm_present: h.alarm_present
      }));
  } else {
     // Fallback generator if ID doesn't match our mock set
      const hours = days * 24;
      mockHistory = Array.from({ length: hours }, (_, i) => ({
        timestamp: new Date(Date.now() - (hours-1-i) * 3600000).toISOString(),
        temp_supply_1: 18 + Math.random() * 2 - 1,
        return_air: 18.5 + Math.random() * 2 - 1,
        relative_humidity: 90 + Math.random() * 5 - 2.5,
        ethylene: i > hours - 20 ? 100 + Math.random() * 20 : 10,
        co2_reading: i > hours - 40 ? 2 + Math.random() : 0.5,
        set_point: 18,
        alarm_present: Math.random() > 0.95 ? 1 : 0
      }));
  }

  // Return mock data immediately
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockHistory), 200);
  });
}

export async function updateDeviceName(id: string, name: string) {
  return sendControlCommand(id, 'manual_update', { name });
}

export async function sendControlCommand(id: string, action: string, params: any) {
  // Also mocking control commands to avoid errors
  return new Promise((resolve) => {
     console.log(`[MOCK] Sending command to ${id}:`, action, params);
     setTimeout(() => resolve({ status: "success", action, params }), 500);
  });

  /*
  try {
    const res = await fetch(`${FUNCTION_URL}/devices/${id}/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ action, params })
    });
    
    if (!res.ok) throw new Error('Failed to send command');
    return res.json();
  } catch (error) {
    console.error('Control Command Failed:', error);
    return { status: "simulated_success", action, params };
  }
  */
}
