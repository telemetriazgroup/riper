import { Recipe } from '../components/recipes/RecipeBuilder';

/**
 * Espejo de las recetas estándar del servidor (ProcessList / demos sin API).
 * IDs: std-aguacate, std-mango, std-banano
 */
export const PERUVIAN_RECIPES: Recipe[] = [
  {
    id: 'std-aguacate',
    name: 'Aguacate — Maduración estándar (tipo Hass)',
    fruit: 'Aguacate',
    description:
      'Parámetros típicos cámara: T 18–20 °C, HR 88–95 %, etileno de disparo ~100 ppm, CO₂ en sala controlado bajo 1 % durante maduración; purga a menor fracción en ventilación.',
    is_system: true,
    phases: [
      { id: 'ph-agu-h', type: 'homogenization', enabled: true, temp: 19, duration: 20, humidity: 90 },
      {
        id: 'ph-agu-r',
        type: 'ripening',
        enabled: true,
        temp: 19,
        duration: 40,
        ethylene: 100,
        co2Limit: 1.0,
        humidity: 92,
      },
      { id: 'ph-agu-v', type: 'venting', enabled: true, temp: 18, duration: 30, co2Limit: 0.4 },
      { id: 'ph-agu-c', type: 'cooling', enabled: true, temp: 5, duration: 8, tempType: 'product' },
    ],
  },
  {
    id: 'std-mango',
    name: 'Mango — Maduración estándar',
    fruit: 'Mango',
    description:
      'Típico operación: 20–22 °C en etapa caliente, HR 90–95 %, etileno 100–150 ppm para inducción; CO₂ máximo de trabajo en sala con ventilación periódica.',
    is_system: true,
    phases: [
      { id: 'ph-man-h', type: 'homogenization', enabled: true, temp: 20, duration: 24, humidity: 92 },
      {
        id: 'ph-man-r',
        type: 'ripening',
        enabled: true,
        temp: 20,
        duration: 48,
        ethylene: 100,
        co2Limit: 1.0,
        humidity: 93,
      },
      { id: 'ph-man-v', type: 'venting', enabled: true, temp: 16, duration: 45, co2Limit: 0.35 },
      { id: 'ph-man-c', type: 'cooling', enabled: true, temp: 12, duration: 6, tempType: 'product' },
    ],
  },
  {
    id: 'std-banano',
    name: 'Banano / Plátano — Maduración estándar',
    fruit: 'Banano',
    description:
      'Esquemas comerciales frecuentes: 15–18 °C, HR 90–95 %, etileno 100–200 ppm; CO₂ bajo estricto en banano. Tiempos variables 3–5 días según verde y color.',
    is_system: true,
    phases: [
      { id: 'ph-ban-h', type: 'homogenization', enabled: true, temp: 16, duration: 24, humidity: 95 },
      {
        id: 'ph-ban-r',
        type: 'ripening',
        enabled: true,
        temp: 16,
        duration: 60,
        ethylene: 150,
        co2Limit: 0.5,
        humidity: 95,
      },
      { id: 'ph-ban-v', type: 'venting', enabled: true, temp: 16, duration: 90, co2Limit: 0.2 },
      { id: 'ph-ban-c', type: 'cooling', enabled: true, temp: 14, duration: 8, tempType: 'air' },
    ],
  },
];
