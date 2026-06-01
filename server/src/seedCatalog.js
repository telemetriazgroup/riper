import { pool } from './db.js';
import { DEFAULT_PRODUCTS, STANDARD_RECIPES } from './data/defaultCatalog.js';

/** Inserta/actualiza las 3 recetas estándar (siempre; no se borran desde UI). */
export async function ensureStandardRecipes() {
  for (const r of STANDARD_RECIPES) {
    await pool.query(
      `INSERT INTO app_recipes (id, name, name_en, fruit, fruit_en, description, description_en, phases, is_system, icon_key, custom_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         name_en = EXCLUDED.name_en,
         fruit = EXCLUDED.fruit,
         fruit_en = EXCLUDED.fruit_en,
         description = EXCLUDED.description,
         description_en = EXCLUDED.description_en,
         phases = EXCLUDED.phases,
         is_system = true,
         icon_key = EXCLUDED.icon_key,
         custom_image_url = COALESCE(EXCLUDED.custom_image_url, app_recipes.custom_image_url),
         updated_at = now(),
         deleted_at = NULL`,
      [
        r.id,
        r.name,
        r.name_en ?? null,
        r.fruit,
        r.fruit_en ?? null,
        r.description,
        r.description_en ?? null,
        JSON.stringify(r.phases),
        r.icon_key ?? null,
        r.custom_image_url ?? null,
      ]
    );
  }
  console.log(`[seed] recetas estándar: ${STANDARD_RECIPES.length} (upsert ok)`);
}

/** Traducciones EN del catálogo base de productos. */
export async function ensureDefaultProductTranslations() {
  for (const p of DEFAULT_PRODUCTS) {
    await pool.query(
      `UPDATE app_products
       SET name_en = $2, updated_at = now()
       WHERE lower(name) = lower($1) AND deleted_at IS NULL`,
      [p.name, p.name_en]
    );
  }
}

export async function seedCatalog() {
  const { rows: pc } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM app_products WHERE deleted_at IS NULL`
  );
  if (pc[0].c === 0) {
    for (let i = 0; i < DEFAULT_PRODUCTS.length; i++) {
      const p = DEFAULT_PRODUCTS[i];
      await pool.query(`INSERT INTO app_products (name, name_en, sort_order) VALUES ($1, $2, $3)`, [
        p.name,
        p.name_en,
        i,
      ]);
    }
    console.log('[seed] app_products: default catalog inserted');
  }

  const { rows: rc } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM app_recipes WHERE deleted_at IS NULL`
  );
  if (rc[0].c === 0) {
    for (const r of STANDARD_RECIPES) {
      await pool.query(
        `INSERT INTO app_recipes (id, name, name_en, fruit, fruit_en, description, description_en, phases, is_system, icon_key, custom_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, $9, $10)`,
        [
          r.id,
          r.name,
          r.name_en ?? null,
          r.fruit,
          r.fruit_en ?? null,
          r.description,
          r.description_en ?? null,
          JSON.stringify(r.phases),
          r.icon_key ?? null,
          r.custom_image_url ?? null,
        ]
      );
    }
    console.log('[seed] app_recipes: initial pack (solo estándar) insertado');
  }

  await ensureStandardRecipes();
  await ensureDefaultProductTranslations();
}
