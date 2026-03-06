import { Recipe } from '../components/recipes/RecipeBuilder';

export const PERUVIAN_RECIPES: Recipe[] = [
  {
    id: 'rec-mango-kent-eu',
    name: 'Mango Kent - Exportación Europa (Aéreo)',
    fruit: 'Mango',
    description: 'Protocolo estándar para envíos aéreos a Europa. Enfocado en homogeneidad de color y firmeza para viaje corto.',
    phases: [
      {
        id: 'ph-1',
        type: 'homogenization',
        enabled: true,
        temp: 20,
        duration: 24,
        humidity: 90
      },
      {
        id: 'ph-2',
        type: 'ripening',
        enabled: true,
        temp: 20,
        duration: 24,
        ethylene: 100,
        co2Limit: 1.0,
        humidity: 90
      },
      {
        id: 'ph-3',
        type: 'venting',
        enabled: true,
        temp: 18,
        duration: 720, // 12 hours in minutes
        co2Limit: 0.5
      },
      {
        id: 'ph-4',
        type: 'cooling',
        enabled: true,
        temp: 10,
        duration: 6,
        tempType: 'product'
      }
    ]
  },
  {
    id: 'rec-palta-hass-local',
    name: 'Palta Hass - Ready to Eat (Supermercados)',
    fruit: 'Palta (Aguacate)',
    description: 'Maduración acelerada para consumo inmediato en mercado local (Lima/Provincias).',
    phases: [
      {
        id: 'ph-1',
        type: 'homogenization',
        enabled: true,
        temp: 18,
        duration: 12,
        humidity: 85
      },
      {
        id: 'ph-2',
        type: 'ripening',
        enabled: true,
        temp: 18,
        duration: 48,
        ethylene: 100,
        co2Limit: 1.0,
        humidity: 90
      },
      {
        id: 'ph-3',
        type: 'venting',
        enabled: true,
        temp: 15,
        duration: 30, // 30 min
        co2Limit: 0.5
      },
      {
        id: 'ph-4',
        type: 'cooling',
        enabled: false, // No cooling needed for immediate delivery
        temp: 6,
        duration: 0,
        tempType: 'product'
      }
    ]
  },
  {
    id: 'rec-banano-org-piura',
    name: 'Banano Orgánico - Piura (Convencional)',
    fruit: 'Banano',
    description: 'Protocolo de maduración de 4 a 6 días para banano orgánico del Valle del Chira.',
    phases: [
      {
        id: 'ph-1',
        type: 'homogenization',
        enabled: true,
        temp: 18,
        duration: 24,
        humidity: 90
      },
      {
        id: 'ph-2',
        type: 'ripening',
        enabled: true,
        temp: 18,
        duration: 24,
        ethylene: 150,
        co2Limit: 1.0,
        humidity: 95
      },
      {
        id: 'ph-3',
        type: 'venting',
        enabled: true,
        temp: 16,
        duration: 60,
        co2Limit: 0.2
      },
      {
        id: 'ph-4',
        type: 'cooling',
        enabled: true,
        temp: 14,
        duration: 12,
        tempType: 'air'
      }
    ]
  },
  {
    id: 'rec-arandano-frio',
    name: 'Arándanos - Solo Frío (Mantenimiento)',
    fruit: 'Arándanos',
    description: 'Solo enfriamiento rápido para despacho.',
    phases: [
      {
        id: 'ph-1',
        type: 'homogenization',
        enabled: false,
        temp: 0, duration: 0
      },
      {
        id: 'ph-2',
        type: 'ripening',
        enabled: false,
        temp: 0, duration: 0
      },
      {
        id: 'ph-3',
        type: 'venting',
        enabled: false,
        temp: 0, duration: 0
      },
      {
        id: 'ph-4',
        type: 'cooling',
        enabled: true,
        temp: 0.5,
        duration: 4,
        tempType: 'product'
      }
    ]
  }
];
