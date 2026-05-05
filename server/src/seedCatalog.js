import { pool } from './db.js';
import { DEFAULT_PRODUCT_NAMES, STANDARD_RECIPES } from './data/defaultCatalog.js';

/** Inserta/actualiza las 3 recetas estándar (siempre; no se borran desde UI). */
export async function ensureStandardRecipes() {
  for (const r of STANDARD_RECIPES) {
    await pool.query(
      `INSERT INTO app_recipes (id, name, fruit, description, phases, is_system, icon_key, custom_image_url)
       VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         fruit = EXCLUDED.fruit,
         description = EXCLUDED.description,
         phases = EXCLUDED.phases,
         is_system = true,
         icon_key = EXCLUDED.icon_key,
         custom_image_url = COALESCE(EXCLUDED.custom_image_url, app_recipes.custom_image_url),
         updated_at = now(),
         deleted_at = NULL`,
      [
        r.id,
        r.name,
        r.fruit,
        r.description,
        JSON.stringify(r.phases),
        r.icon_key ?? null,
        r.custom_image_url ?? null,
      ]
    );
  }
  console.log(`[seed] recetas estándar: ${STANDARD_RECIPES.length} (upsert ok)`);
}

export async function seedCatalog() {
  const { rows: pc } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM app_products WHERE deleted_at IS NULL`
  );
  if (pc[0].c === 0) {
    for (let i = 0; i < DEFAULT_PRODUCT_NAMES.length; i++) {
      await pool.query(`INSERT INTO app_products (name, sort_order) VALUES ($1, $2)`, [
        DEFAULT_PRODUCT_NAMES[i],
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
        `INSERT INTO app_recipes (id, name, fruit, description, phases, is_system, icon_key, custom_image_url)
         VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $7)`,
        [
          r.id,
          r.name,
          r.fruit,
          r.description,
          JSON.stringify(r.phases),
          r.icon_key ?? null,
          r.custom_image_url ?? null,
        ]
      );
    }
    console.log('[seed] app_recipes: initial pack (solo estándar) insertado');
  }

  await ensureStandardRecipes();
}
