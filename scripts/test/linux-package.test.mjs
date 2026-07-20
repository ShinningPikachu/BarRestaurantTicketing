import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('Linux package has a valid rollback launcher and a sanitized payload', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bar-ticketing-package-test-'));
  const outputPath = join(directory, 'application.run');

  try {
    const build = spawnSync(process.execPath, [resolve('scripts/build-linux-run.mjs')], {
      cwd: process.cwd(),
      env: { ...process.env, BAR_TICKETING_LINUX_OUTPUT: outputPath },
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.ok((statSync(outputPath).mode & 0o111) !== 0, 'package must be executable');

    const content = readFileSync(outputPath);
    const marker = Buffer.from('__BAR_RESTAURANT_TICKETING_PAYLOAD_BELOW__\n');
    const markerOffset = content.indexOf(marker);
    assert.ok(markerOffset > 0, 'payload marker must exist');

    const launcher = content.subarray(0, markerOffset + marker.length);
    const launcherPath = join(directory, 'launcher.sh');
    const payloadPath = join(directory, 'payload.tar.gz');
    writeFileSync(launcherPath, launcher);
    writeFileSync(payloadPath, content.subarray(markerOffset + marker.length));

    const shellCheck = spawnSync('bash', ['-n', launcherPath], { encoding: 'utf8' });
    assert.equal(shellCheck.status, 0, shellCheck.stderr);

    const launcherText = launcher.toString('utf8');
    assert.match(launcherText, /for suffix in "" "-journal" "-wal" "-shm"/);
    assert.match(launcherText, /mv "\$INSTALL_DIR" "\$PREVIOUS_DIR"/);
    assert.match(launcherText, /previous installation was restored/);

    const archive = spawnSync('tar', ['-tzf', payloadPath], {
      encoding: 'utf8',
      maxBuffer: 10_000_000,
    });
    assert.equal(archive.status, 0, archive.stderr);
    const paths = archive.stdout.split('\n').filter(Boolean);
    assert.ok(paths.some((path) => path.endsWith('/20260718150000_unique_menu_sku/migration.sql')));
    assert.ok(paths.some((path) => path.endsWith('/PRODUCTION_FIRST_RUN.md')));
    assert.ok(paths.some((path) => path.endsWith('/CHANGESET_PRODUCTION_REVIEW.md')));
    assert.equal(paths.some((path) => /(?:^|\/)\.env$/.test(path)), false);
    assert.equal(paths.some((path) => /(?:^|\/)dev\.db(?:$|[-.])/.test(path)), false);
    assert.equal(paths.some((path) => path.includes('/node_modules/')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
