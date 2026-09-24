import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const run = promisify(execFile);
const project = 'keyspace-capacity-final', container = project + '-keyspace-1';
const base = 'http://127.0.0.1:5283', image = 'keyspace-challenge:local';
const load = JSON.parse(await readFile('artifacts/challenge/load-report.json', 'utf8'));
if (!load.passed || load.base !== base) throw new Error('Complete the isolated capacity test first');
const stamp = Date.now(), backup = '/backups/validation-' + stamp + '.sqlite', volume = 'keyspace-restore-validation-' + stamp;
const restoredContainer = 'keyspace-restore-validation-' + stamp, restoredBase = 'http://127.0.0.1:5285';
const docker = async args => (await run('docker', args, { maxBuffer: 1024 * 1024 })).stdout.trim();
const snapshotCode = String.raw`import DB from 'better-sqlite3'; import {createHash} from 'node:crypto';
const db=new DB('/data/keyspace.sqlite',{readonly:true});
const tables=Object.fromEntries(['players','runs','records'].map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY id').all()]));
const result={sqlite:db.prepare('SELECT sqlite_version() AS version').get().version,wal:db.pragma('journal_mode',{simple:true}),integrity:db.pragma('integrity_check',{simple:true}),foreignKeys:db.pragma('foreign_key_check').length,counts:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])),digest:createHash('sha256').update(JSON.stringify(tables)).digest('hex')};
db.close(); console.log(JSON.stringify(result));`;
async function snapshot(name) { return JSON.parse(await docker(['exec', name, 'node', '--input-type=module', '-e', snapshotCode])); }
async function healthy(url) {
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(url + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Service did not become healthy: ' + url);
}
const before = await snapshot(container);
if (before.counts.records !== load.expectedRecords || before.counts.players !== load.users || before.integrity !== 'ok' || before.foreignKeys !== 0) throw new Error('Storage totals/integrity mismatch');
const onlineBackup = JSON.parse(await docker(['exec', container, 'node', 'scripts/backup-db.mjs', backup]));
await docker(['restart', container]); await healthy(base);
const restarted = await snapshot(container);
if (!isDeepStrictEqual(before, restarted)) throw new Error('Restart changed data');
// Recreate the container, retaining only the named data volume.
await run('docker', ['compose', '-p', project, 'up', '-d', '--force-recreate'], { env: { ...process.env, PUBLIC_ORIGIN: base, KEYSPACE_PORT: '5283' } });
await healthy(base); const recreated = await snapshot(container);
if (!isDeepStrictEqual(before, recreated)) throw new Error('Container recreation changed data');
await docker(['volume', 'create', volume]);
const restoreCode = "import {copyFileSync,existsSync,chownSync} from 'node:fs'; const target='/data/keyspace.sqlite'; if(existsSync(target))throw Error('Target exists'); copyFileSync(" + JSON.stringify(backup) + ",target); chownSync('/data',1000,1000); chownSync(target,1000,1000);";
await docker(['run', '--rm', '--network', 'none', '--user', '0', '--mount', 'type=volume,src=' + project + '_keyspace-backups,dst=/backups,readonly', '--mount', 'type=volume,src=' + volume + ',dst=/data', image, 'node', '--input-type=module', '-e', restoreCode]);
await docker(['run', '-d', '--name', restoredContainer, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--cpus', '2', '--memory', '1g', '-p', '127.0.0.1:5285:3000', '-e', 'PUBLIC_ORIGIN=' + restoredBase, '--mount', 'type=volume,src=' + volume + ',dst=/data', image]);
try {
  await healthy(restoredBase);
  const restored = await snapshot(restoredContainer);
  if (!isDeepStrictEqual(before, restored)) throw new Error('Restored database differs');
  for (const choice of ['korean', 'english']) {
    const original = await (await fetch(base + '/api/leaderboard?choice=' + choice)).json();
    const copy = await (await fetch(restoredBase + '/api/leaderboard?choice=' + choice)).json();
    if (!isDeepStrictEqual(original, copy)) throw new Error('Restored board differs');
  }
  const report = { at: new Date().toISOString(), before, restarted, recreated, restored, onlineBackup, restoredVolume: volume, boardsEqual: true };
  await writeFile('artifacts/challenge/storage-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await docker(['stop', restoredContainer]); }
