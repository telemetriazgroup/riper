import type { Recipe } from '@/app/components/recipes/RecipeBuilder';
import type { AppProduct } from '@/app/lib/productsApi';

type Language = 'es' | 'en';

export type CatalogI18nFields = {
  name_en?: string | null;
  fruit_en?: string | null;
  description_en?: string | null;
};

/** Fallback estático (offline / antes de migración) alineado con defaultCatalog.js */
const STANDARD_RECIPE_I18N: Record<
  string,
  { name: string; fruit: string; description: string }
> = {
  'std-aguacate': {
    name: 'Avocado — Standard ripening (Hass type)',
    fruit: 'Avocado',
    description:
      'Typical chamber parameters: T 18–20 °C, RH 88–95%, trigger ethylene ~100 ppm, room CO₂ kept below 1% during ripening; purge to a lower fraction during venting. Adjust per lot and destination (RTE, export).',
  },
  'std-mango': {
    name: 'Mango — Standard ripening',
    fruit: 'Mango',
    description:
      'Typical operation: 20–22 °C in the hot stage, RH 90–95%, ethylene 100–150 ppm for induction; maximum working CO₂ in the room with periodic ventilation. Indicative durations by variety (Kent, Tommy Atkins, etc.).',
  },
  'std-banano': {
    name: 'Banana / Plantain — Standard ripening',
    fruit: 'Banana',
    description:
      'Common commercial schemes: 15–18 °C, RH 90–95%, ethylene 100–200 ppm; strict low CO₂ for banana (ventilate more often). Variable times 3–5 days depending on greenness and required color profile.',
  },
};

const DEFAULT_PRODUCT_I18N: Record<string, string> = {
  Aguacate: 'Avocado',
  Mango: 'Mango',
  Banano: 'Banana',
  Cítricos: 'Citrus',
  Arándanos: 'Blueberries',
};

function recipeEnFields(recipe: Recipe & CatalogI18nFields) {
  const fallback = STANDARD_RECIPE_I18N[recipe.id];
  return {
    name: recipe.name_en?.trim() || fallback?.name || recipe.name,
    fruit: recipe.fruit_en?.trim() || fallback?.fruit || recipe.fruit,
    description: recipe.description_en?.trim() || fallback?.description || recipe.description,
  };
}

export function localizeRecipe<T extends Recipe & CatalogI18nFields>(recipe: T, language: Language): T {
  if (language !== 'en') return recipe;
  const en = recipeEnFields(recipe);
  return { ...recipe, name: en.name, fruit: en.fruit, description: en.description };
}

export function productDisplayName(
  product: Pick<AppProduct, 'name' | 'name_en'>,
  language: Language
): string {
  if (language !== 'en') return product.name;
  return product.name_en?.trim() || DEFAULT_PRODUCT_I18N[product.name] || product.name;
}

export function productNameEn(name: string, nameEn?: string | null): string {
  return nameEn?.trim() || DEFAULT_PRODUCT_I18N[name] || name;
}

export function localizedProductName(name: string, language: Language, nameEn?: string | null): string {
  if (language !== 'en') return name;
  return productNameEn(name, nameEn);
}
