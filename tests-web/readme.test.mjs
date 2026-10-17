import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GESTURE_CATALOG } from '../public/js/config.js';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const seconds = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

test('the README gesture table matches the recognizer catalog', () => {
  const section = readme.split('## Gestos')[1].split('\n## ')[0];
  const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Gesto') && !l.startsWith('|---'));
  const parsed = rows.map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const expected = GESTURE_CATALOG.map((g) => [g.label, g.holdMs > 0 ? `${seconds.format(g.holdMs / 1000)} s` : '—', g.action]);
  assert.deepEqual(parsed, expected);
});

test('the README ends with the standard signature and has no residue', () => {
  assert.match(readme, /### Desenvolvido por Matheus Siqueira\n\n\*\*Analista de Dados & BI \| Power BI • SQL • Python • DAX \| ETL, Modelagem de Dados, KPIs e Automação\*\*/);
  assert.ok(readme.trimEnd().endsWith('(mailto:hellomatheusdev@gmail.com)'));
  assert.doesNotMatch(readme, /seu-repo-url|Parabéns|❤|Built by|Polegar|thumb/i);
});
