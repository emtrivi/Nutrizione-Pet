/// <reference types="node" />
// La parte nativa non è cambiata: l'impronta calcolata come la calcola Expo (runtimeVersion "fingerprint")
// deve essere quella della build installata sul telefono (release/impronta-ios.json). Altrimenti
// l'aggiornamento via internet non arriverebbe: serve una build nuova con il file di rinnovo.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

describe('impronta della parte nativa', () => {
  it('coincide con quella della build installata (release/impronta-ios.json)', () => {
    const expected = JSON.parse(readFileSync(join(root, 'release', 'impronta-ios.json'), 'utf8')).impronta;
    const out = execFileSync('npx', ['expo-updates', 'fingerprint:generate', '--platform', 'ios'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(JSON.parse(out).hash).toBe(expected);
  }, 180_000);

  it('il flusso «Pubblica versione» fa solo l’aggiornamento via internet, solo dal ramo principale', () => {
    const yml = readFileSync(join(root, '.eas', 'workflows', 'pubblica.yml'), 'utf8');
    expect(yml).toContain("branches: ['claude/dog-recipe-app-phase-1-fp4zxh']");
    expect(yml).toContain('type: update');
    expect(yml).toContain('channel: production');
    for (const forbidden of ['type: build', 'type: submit', 'type: get-build', 'needs:']) expect(yml).not.toContain(forbidden);
  });
});
