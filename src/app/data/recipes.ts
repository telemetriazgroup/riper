import { Recipe } from '../components/recipes/RecipeBuilder';

/**
 * Espejo de las recetas estándar del servidor (ProcessList / demos sin API).
 * IDs: std-aguacate, std-mango, std-banano
 */
export const PERUVIAN_RECIPES: Recipe[] = [
  {
    id: 'std-aguacate',
    iconKey: 'palta',
    name: 'Aguacate — Maduración estándar (tipo Hass)',
    name_en: 'Avocado — Standard ripening (Hass type)',
    fruit: 'Aguacate',
    fruit_en: 'Avocado',
    description:
      'Parámetros típicos cámara: T 18–20 °C, HR 88–95 %, etileno de disparo ~100 ppm, CO₂ en sala controlado bajo 1 % durante maduración; purga a menor fracción en ventilación.',
    description_en:
      'Typical chamber parameters: T 18–20 °C, RH 88–95%, trigger ethylene ~100 ppm, room CO₂ kept below 1% during ripening; purge to a lower fraction during venting.',
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
    iconKey: 'mango',
    name: 'Mango — Maduración estándar',
    name_en: 'Mango — Standard ripening',
    fruit: 'Mango',
    fruit_en: 'Mango',
    description:
      'Típico operación: 20–22 °C en etapa caliente, HR 90–95 %, etileno 100–150 ppm para inducción; CO₂ máximo de trabajo en sala con ventilación periódica.',
    description_en:
      'Typical operation: 20–22 °C in the hot stage, RH 90–95%, ethylene 100–150 ppm for induction; maximum working CO₂ in the room with periodic ventilation.',
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
    iconKey: 'banana',
    name: 'Banano / Plátano — Maduración estándar',
    name_en: 'Banana / Plantain — Standard ripening',
    fruit: 'Banano',
    fruit_en: 'Banana',
    description:
      'Esquemas comerciales frecuentes: 15–18 °C, HR 90–95 %, etileno 100–200 ppm; CO₂ bajo estricto en banano. Tiempos variables 3–5 días según verde y color.',
    description_en:
      'Common commercial schemes: 15–18 °C, RH 90–95%, ethylene 100–200 ppm; strict low CO₂ for banana (ventilate more often). Variable times 3–5 days depending on greenness and required color profile.',
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
