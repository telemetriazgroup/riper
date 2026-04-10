import { pool } from './db.js';
import { DEFAULT_PRODUCT_NAMES, DEFAULT_RECIPES } from './data/defaultCatalog.js';

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
    for (const r of DEFAULT_RECIPES) {
      await pool.query(
        `INSERT INTO app_recipes (id, name, fruit, description, phases)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [r.id, r.name, r.fruit, r.description, JSON.stringify(r.phases)]
      );
    }
    console.log('[seed] app_recipes: default recipes inserted');
  }
}
