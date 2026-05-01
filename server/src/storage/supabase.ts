/**
 * Supabase-backed portfolio storage — B5-CR
 *
 * Reads/writes the `portfolios` table (schema in server/migrations/001_portfolios.sql).
 * Uses the admin (service-role) client to bypass Row Level Security server-side.
 *
 * Table layout:
 *   portfolios (
 *     user_id   uuid primary key,
 *     data      jsonb,
 *     updated_at timestamptz
 *   )
 *
 * `userId` must be non-null when using this store.
 */

import * as supabaseProvider from '../providers/supabase.js';
import type { PortfolioStorage, PortfolioStore } from './types.js';
import { buildSeedData } from './seed.js';

/** Name of the portfolios table in Supabase. */
const TABLE = 'portfolios';

export const supabaseStore: PortfolioStorage = {
  async read(userId: string | null): Promise<PortfolioStore> {
    if (!userId) {
      console.error('[supabaseStore] read called with null userId — returning seed');
      return buildSeedData();
    }

    const sb = supabaseProvider.client();

    const { data, error } = await sb
      .from(TABLE)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[supabaseStore] read error:', error.message);
      // Return seed so the UI still renders something
      return buildSeedData();
    }

    if (!data) {
      // First login — seed the row so subsequent reads find data immediately.
      const seed = buildSeedData();
      await supabaseStore.write(userId, seed);
      return seed;
    }

    return data.data as PortfolioStore;
  },

  async write(userId: string | null, portfolio: PortfolioStore): Promise<void> {
    if (!userId) {
      console.error('[supabaseStore] write called with null userId — skipping');
      return;
    }

    const sb = supabaseProvider.client();

    const { error } = await sb.from(TABLE).upsert(
      {
        user_id:    userId,
        data:       portfolio,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[supabaseStore] write error:', error.message);
    }
  },
};
