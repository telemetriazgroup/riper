import React from 'react';

/** Campos mínimos para icono / imagen (evita dependencia circular con RecipeBuilder). */
export type RecipeVisualFields = {
  fruit: string;
  iconKey?: string | null;
  customImageUrl?: string | null;
};

/** Nombres sugeridos (se anteponen al catálogo en el selector de producto). */
export const RECIPE_FRUIT_SUGGESTIONS: string[] = [
  'Palta',
  'Aguacate',
  'Mango',
  'Banano',
  'Plátano',
  'Fresa',
  'Arándanos',
  'Cítricos',
  'Uva',
  'Manzana',
  'Pera',
  'Kiwi',
  'Piña',
  'Sandía',
  'Melón',
];

export type RecipeIconPreset = {
  key: string;
  emoji: string;
  /** Subcadenas normalizadas que matchean el nombre de producto / fruta */
  aliases: string[];
};

export const RECIPE_ICON_PRESETS: RecipeIconPreset[] = [
  { key: 'palta', emoji: '🥑', aliases: ['palta', 'aguacate', 'avocado', 'hass'] },
  { key: 'mango', emoji: '🥭', aliases: ['mango'] },
  { key: 'banana', emoji: '🍌', aliases: ['banano', 'platano', 'plátano', 'banana'] },
  { key: 'fresa', emoji: '🍓', aliases: ['fresa', 'frutilla', 'strawberry'] },
  { key: 'arandano', emoji: '🫐', aliases: ['arandano', 'arándano', 'arandanos', 'arándanos', 'blueberry'] },
  { key: 'citrico', emoji: '🍊', aliases: ['citrico', 'cítrico', 'citrus', 'naranja', 'limon', 'limón', 'mandarina'] },
  { key: 'uva', emoji: '🍇', aliases: ['uva', 'grape'] },
  { key: 'manzana', emoji: '🍎', aliases: ['manzana', 'apple'] },
  { key: 'pera', emoji: '🍐', aliases: ['pera', 'pear'] },
  { key: 'kiwi', emoji: '🥝', aliases: ['kiwi'] },
  { key: 'pina', emoji: '🍍', aliases: ['pina', 'piña', 'pineapple', 'anana', 'ananá'] },
  { key: 'sandia', emoji: '🍉', aliases: ['sandia', 'sandía', 'watermelon'] },
  { key: 'melon', emoji: '🍈', aliases: ['melon', 'melón', 'cantaloupe'] },
  { key: 'cereza', emoji: '🍒', aliases: ['cereza', 'cherry'] },
];

const PRESET_BY_KEY = new Map(RECIPE_ICON_PRESETS.map((p) => [p.key, p]));

function normalizeFruitToken(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Mejor preset según texto de fruta / producto (nombre mostrado). */
export function iconKeyFromFruitName(fruit: string): string | null {
  const n = normalizeFruitToken(fruit);
  if (!n) return null;
  for (const p of RECIPE_ICON_PRESETS) {
    for (const a of p.aliases) {
      const na = normalizeFruitToken(a);
      if (na && (n === na || n.includes(na) || na.includes(n))) {
        return p.key;
      }
    }
  }
  return null;
}

export function getPresetByKey(key: string | null | undefined): RecipeIconPreset | undefined {
  if (!key) return undefined;
  return PRESET_BY_KEY.get(key);
}

export type RecipeVisual = {
  emoji: string | null;
  imageUrl: string | null;
};

export function resolveRecipeVisual(r: RecipeVisualFields): RecipeVisual {
  const url = r.customImageUrl?.trim();
  if (url) return { emoji: null, imageUrl: url };
  const preset = getPresetByKey(r.iconKey) ?? getPresetByKey(iconKeyFromFruitName(r.fruit) ?? undefined);
  if (preset) return { emoji: preset.emoji, imageUrl: null };
  return { emoji: '🍏', imageUrl: null };
}

type AvatarProps = {
  recipe: RecipeVisualFields;
  className?: string;
  sizeClass?: string;
  title?: string;
};

/** Avatar cuadrado redondeado: imagen externa o emoji. */
export const RecipeFruitAvatar: React.FC<AvatarProps> = ({
  recipe,
  className = '',
  sizeClass = 'w-12 h-12',
  title,
}) => {
  const { emoji, imageUrl } = resolveRecipeVisual(recipe);
  if (imageUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ${sizeClass} ${className}`}
        title={title}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50 text-2xl leading-none shadow-sm ${sizeClass} ${className}`}
      title={title}
      role="img"
    >
      {emoji ?? '🍏'}
    </span>
  );
};
