import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// These checksums identify the earlier, destructive versions documented in
// CHANGESET_PRODUCTION_REVIEW.md. Existing installations that already applied
// them remain operational, but changing the migration files cannot restore
// workflow history that an earlier version removed.
export const KNOWN_LEGACY_MIGRATION_CHECKSUMS = new Map([
  [
    '20260718120000_backend_integrity',
    new Set(['bda9e321e45429b8af6934dc07cada6ffc6c711e63621e1685ea70712d22eeb0']),
  ],
  [
    '20260718130000_remove_dead_workflow_models',
    new Set(['31092756932706d0ceaec957c60da9da27ff608532f01de7366fffb518eb43fd']),
  ],
  [
    '20260718150000_unique_menu_sku',
    new Set(['73ba454cd9b97ed3a8631d6eb61cc3e036624acdec7138f4492a78610179454b']),
  ],
]);

export function migrationChecksums(migrationsDir) {
  return new Map(
    readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [
        entry.name,
        createHash('sha256')
          .update(readFileSync(join(migrationsDir, entry.name, 'migration.sql')))
          .digest('hex'),
      ]),
  );
}

export function auditMigrationHistoryRows(
  rows,
  currentChecksums,
  knownLegacyChecksums = KNOWN_LEGACY_MIGRATION_CHECKSUMS,
) {
  const unfinished = rows.filter((row) => !row.finished_at && !row.rolled_back_at);
  if (unfinished.length > 0) {
    throw new Error(
      `Database contains an unfinished migration (${unfinished.map((row) => row.migration_name).join(', ')}); investigate it before retrying.`,
    );
  }

  const appliedRows = rows.filter((row) => row.finished_at && !row.rolled_back_at);
  const appliedCounts = new Map();
  for (const row of appliedRows) {
    appliedCounts.set(row.migration_name, (appliedCounts.get(row.migration_name) || 0) + 1);
  }
  const duplicateApplied = [...appliedCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
  if (duplicateApplied.length > 0) {
    throw new Error(
      `Database marks a migration as applied more than once (${duplicateApplied.join(', ')}); investigate its migration history before startup.`,
    );
  }

  const warnings = [];
  for (const row of appliedRows) {
    const expectedChecksum = currentChecksums.get(row.migration_name);
    if (!expectedChecksum) {
      throw new Error(
        `Database contains applied migration ${row.migration_name}, but its migration file is missing from this release.`,
      );
    }
    if (row.checksum === expectedChecksum) continue;

    const knownChecksums = knownLegacyChecksums.get(row.migration_name);
    if (!knownChecksums?.has(row.checksum)) {
      throw new Error(
        `Applied migration ${row.migration_name} does not match this release; refusing to continue with unknown migration history.`,
      );
    }
    warnings.push(row.migration_name);
  }

  return {
    applied: new Set(appliedRows.map((row) => row.migration_name)),
    warnings,
  };
}
