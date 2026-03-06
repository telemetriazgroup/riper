import { Hono } from "npm:hono@4.1.0";
import { cors } from "npm:hono@4.1.0/cors";
import { logger } from "npm:hono@4.1.0/logger";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// --- TYPES ---

interface TelemetryData {
  temp_supply_1: number;
  return_air: number;
  relative_humidity: number;
  ethylene: number | null;
  co2_reading: number | null;
  set_point: number;
  stateProcess: 'None' | 'Homogenization' | 'Ripening' | 'Ventilation' | 'Cooling' | 'Integral';
  power_state: 0 | 1;
  alarm_present: 0 | 1;
  timestamp?: string;
}

interface OperationalData {
  evaporation_coil: number;
  condensation_coil: number;
  ambient_air: number;
  power_consumption: number;
  power_kwh: number;
  battery_voltage: number;
  defrost_interval: number;
  fresh_air_ex_mode: number;
}

interface Device {
  id: string;
  name: string;
  status: 'active' | 'warning' | 'alarm' | 'offline';
  telemetry: TelemetryData;
  operational: OperationalData;
  process?: {
    name: string;
    progress: number;
    startTime: string;
    endTime: string;
    currentPhase?: string;
    timeLeft?: string;
    recipeId?: number;
  };
}

// --- MOCK DATA FOR SEEDING ---

const INITIAL_DEVICES: Device[] = [
  {
    id: 'ZGRU5140008',
    name: 'Madurador 01',
    status: 'active',
    telemetry: {
      temp_supply_1: 19,
      return_air: 19.5,
      relative_humidity: 97,
      ethylene: 120,
      co2_reading: 3.5,
      set_point: 19,
      stateProcess: 'Ripening',
      power_state: 1,
      alarm_present: 0
    },
    operational: {
      evaporation_coil: 19.3,
      condensation_coil: 20.5,
      ambient_air: 20,
      power_consumption: 0.01,
      power_kwh: 8062.4,
      battery_voltage: 41.8,
      defrost_interval: 6,
      fresh_air_ex_mode: 0
    },
    process: {
      name: 'Mango Kent - Maduración Estándar',
      progress: 45,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // started 24h ago
      endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      currentPhase: 'Maduración',
      timeLeft: '48h 00min',
      recipeId: 1
    }
  },
  {
    id: 'ZGRU5140009',
    name: 'Madurador 02',
    status: 'warning',
    telemetry: {
      temp_supply_1: 14,
      return_air: 14.8,
      relative_humidity: 82,
      ethylene: 10,
      co2_reading: 0.5,
      set_point: 14,
      stateProcess: 'Homogenization',
      power_state: 1,
      alarm_present: 0
    },
    operational: {
      evaporation_coil: 14.1,
      condensation_coil: 15.2,
      ambient_air: 16,
      power_consumption: 0.02,
      power_kwh: 4030.1,
      battery_voltage: 41.5,
      defrost_interval: 6,
      fresh_air_ex_mode: 0
    },
    process: {
      name: 'Palta Hass - Pre-maduración',
      progress: 10,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      currentPhase: 'Homogenización',
      timeLeft: '6h 00min',
      recipeId: 2
    }
  },
  {
    id: 'ZGRU5140010',
    name: 'Madurador 03',
    status: 'offline',
    telemetry: {
      temp_supply_1: 0,
      return_air: 0,
      relative_humidity: 0,
      ethylene: null,
      co2_reading: null,
      set_point: 0,
      stateProcess: 'None',
      power_state: 0,
      alarm_present: 0
    },
    operational: {
      evaporation_coil: 0,
      condensation_coil: 0,
      ambient_air: 24,
      power_consumption: 0,
      power_kwh: 12050.5,
      battery_voltage: 0,
      defrost_interval: 6,
      fresh_air_ex_mode: 0
    }
  },
  {
    id: 'ZGRU5140011',
    name: 'Madurador 04',
    status: 'alarm',
    telemetry: {
      temp_supply_1: 22,
      return_air: 23,
      relative_humidity: 99,
      ethylene: 200,
      co2_reading: 6.0,
      set_point: 18,
      stateProcess: 'Ripening',
      power_state: 1,
      alarm_present: 1
    },
    operational: {
      evaporation_coil: 21.5,
      condensation_coil: 25.0,
      ambient_air: 22,
      power_consumption: 0.05,
      power_kwh: 500.2,
      battery_voltage: 41.2,
      defrost_interval: 4,
      fresh_air_ex_mode: 1
    },
    process: {
      name: 'Banana - Ciclo Rápido',
      progress: 80,
      startTime: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      currentPhase: 'Maduración',
      timeLeft: '10h 00min',
      recipeId: 3
    }
  }
];

// --- ENDPOINTS ---

const PREFIX = "/make-server-d24c9284";

// Health check
app.get(PREFIX + "/health", (c) => {
  return c.json({ status: "ok" });
});

// Seed data
app.post(PREFIX + "/seed", async (c) => {
  try {
    const existing = await kv.getByPrefix("device:");
    if (existing && existing.length > 0) {
      return c.json({ status: "already_seeded", count: existing.length });
    }
    
    for (const d of INITIAL_DEVICES) {
      await kv.set(`device:${d.id}`, d);
    }
    return c.json({ status: "seeded", count: INITIAL_DEVICES.length });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Create Admin User
app.post(PREFIX + "/create-admin", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return c.json({ error: "Missing Supabase configuration" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@reefer.com',
      password: 'admin-password-123',
      user_metadata: { name: 'Admin User' },
      email_confirm: true
    });

    if (error) {
       // If user already exists, that's fine, just return success or info
       if (error.message.includes("already registered")) {
         return c.json({ status: "user_exists", email: 'admin@reefer.com' });
       }
       return c.json({ error: error.message }, 400);
    }

    return c.json({ status: "created", user: data.user });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});


// Helper to update process status
function updateProcessStatus(device: Device): Device {
  if (device.process) {
    const now = new Date().getTime();
    const start = new Date(device.process.startTime).getTime();
    const end = new Date(device.process.endTime).getTime();
    const total = end - start;
    const elapsed = now - start;
    
    if (elapsed >= total) {
       device.process.progress = 100;
       device.process.timeLeft = "0h 00min";
    } else {
       const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
       device.process.progress = Math.round(progress);
       
       const leftMs = total - elapsed;
       const leftHours = Math.floor(leftMs / (1000 * 60 * 60));
       const leftMins = Math.floor((leftMs % (1000 * 60 * 60)) / (1000 * 60));
       device.process.timeLeft = `${leftHours}h ${leftMins}min`;
    }
  }
  return device;
}

// List devices
app.get(PREFIX + "/devices", async (c) => {
  try {
    const devices = await kv.getByPrefix("device:");
    // If no devices, try to seed automatically for better UX
    if (devices.length === 0) {
      for (const d of INITIAL_DEVICES) {
        await kv.set(`device:${d.id}`, d);
      }
      return c.json(INITIAL_DEVICES.map(updateProcessStatus));
    }
    return c.json(devices.map(updateProcessStatus));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Get single device
app.get(PREFIX + "/devices/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const device = await kv.get(`device:${id}`);
    if (!device) return c.json({ error: "Device not found" }, 404);
    return c.json(updateProcessStatus(device));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Get device history
app.get(PREFIX + "/devices/:id/history", async (c) => {
  const id = c.req.param("id");
  const days = parseInt(c.req.query("days") || "1");
  
  try {
    const history = await kv.getByPrefix(`history:${id}:`);
    const sorted = history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // If no history, or requesting more history than available (simulated), generate mock
    if (sorted.length === 0 || days > 1) {
       // Generate mock data based on requested days (hourly points)
       const hours = days * 24;
       const mockHistory = Array.from({ length: hours }, (_, i) => ({
          timestamp: new Date(Date.now() - (hours-1-i) * 3600000).toISOString(),
          temp_supply_1: 18 + Math.random() * 2 - 1,
          return_air: 18.5 + Math.random() * 2 - 1,
          relative_humidity: 90 + Math.random() * 5 - 2.5,
          ethylene: i > hours - 20 ? 100 + Math.random() * 20 : 10, // Spike at end
          co2_reading: i > hours - 40 ? 2 + Math.random() : 0.5,
          set_point: 18,
          alarm_present: Math.random() > 0.95 ? 1 : 0 // Occasional alarm
       }));
       return c.json(mockHistory);
    }
    
    return c.json(sorted);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Receive Telemetry (Ingestion)
app.post(PREFIX + "/devices/:id/telemetry", async (c) => {
  const id = c.req.param("id");
  try {
    const payload = await c.req.json();
    const device = await kv.get(`device:${id}`);
    
    if (!device) {
      // Create new device if not exists (Auto-provisioning)
      const newDevice = {
        id,
        name: `Madurador ${id.slice(-4)}`,
        status: 'active',
        telemetry: { ...payload, timestamp: new Date().toISOString() },
        operational: {
           evaporation_coil: 0, condensation_coil: 0, ambient_air: 0,
           power_consumption: 0, power_kwh: 0, battery_voltage: 0,
           defrost_interval: 0, fresh_air_ex_mode: 0
        }
      };
      await kv.set(`device:${id}`, newDevice);
      return c.json({ status: "created", device: newDevice });
    }

    // Update telemetry
    const updatedDevice = {
      ...device,
      telemetry: { ...device.telemetry, ...payload, timestamp: new Date().toISOString() }
    };

    // Update status based on alarms
    if (payload.alarm_present === 1) {
      updatedDevice.status = 'alarm';
    } else if (payload.stateProcess === 'None' || payload.power_state === 0) {
      updatedDevice.status = 'offline'; 
    } else {
      updatedDevice.status = 'active';
    }

    // Save history record (limit retention logic could be added here, but skipping for now)
    // We use a timestamp sortable key
    const ts = new Date().toISOString();
    await kv.set(`history:${id}:${ts}`, { ...payload, timestamp: ts });
    
    // AUTOMATION LOGIC: Update Process Progress
    if (updatedDevice.process) {
      const now = new Date().getTime();
      const start = new Date(updatedDevice.process.startTime).getTime();
      const end = new Date(updatedDevice.process.endTime).getTime();
      const total = end - start;
      const elapsed = now - start;
      
      if (elapsed >= total) {
         updatedDevice.process.progress = 100;
         updatedDevice.process.timeLeft = "0h 00min";
         // Maybe finish process?
      } else {
         const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
         updatedDevice.process.progress = Math.round(progress);
         
         const leftMs = total - elapsed;
         const leftHours = Math.floor(leftMs / (1000 * 60 * 60));
         const leftMins = Math.floor((leftMs % (1000 * 60 * 60)) / (1000 * 60));
         updatedDevice.process.timeLeft = `${leftHours}h ${leftMins}min`;
      }
    }

    await kv.set(`device:${id}`, updatedDevice);
    
    // Return control commands (response to telemetry)
    // This is where we would send back setpoints if they changed
    return c.json({ 
      set_point: updatedDevice.telemetry.set_point,
      control_mode: updatedDevice.telemetry.stateProcess
    });

  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Control Endpoint (Manual commands from frontend)
app.post(PREFIX + "/devices/:id/control", async (c) => {
  const id = c.req.param("id");
  try {
    const { action, params } = await c.req.json();
    const device = await kv.get(`device:${id}`);
    
    if (!device) return c.json({ error: "Device not found" }, 404);

    if (action === "set_process") {
       // Start a new process
       device.telemetry.stateProcess = params.type; // 'Ripening', etc.
       device.process = {
         name: params.name,
         startTime: new Date().toISOString(),
         endTime: new Date(Date.now() + params.durationHours * 3600000).toISOString(),
         progress: 0,
         currentPhase: params.type,
         timeLeft: `${params.durationHours}h 00min`,
         recipeId: params.recipeId
       };
       // Update setpoints
       if (params.setPoint) device.telemetry.set_point = params.setPoint;
       device.telemetry.power_state = 1;
       device.status = 'active';

    } else if (action === "stop_process") {
       device.telemetry.stateProcess = 'None';
       device.process = undefined;
       device.status = 'active'; // or standby

    } else if (action === "manual_update") {
       // Update specific setpoints
       if (params.name !== undefined) device.name = params.name;
       if (params.set_point !== undefined) device.telemetry.set_point = params.set_point;
       if (params.power_state !== undefined) device.telemetry.power_state = params.power_state;
       if (params.ethylene !== undefined) device.telemetry.ethylene = params.ethylene;
       // ... other params
    }

    await kv.set(`device:${id}`, device);
    return c.json({ status: "updated", device });

  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

Deno.serve(app.fetch);
