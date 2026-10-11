import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));

test('footer is the A.9 markup with the manifest version', () => {
  assert.equal((html.match(/<footer class="ms-footer">/g) ?? []).length, 1);
  assert.match(html, /<a href="https:\/\/www\.matheussiqueira\.dev">Desenvolvido por Matheus Siqueira<\/a>/);
  assert.match(html, /<a href="https:\/\/www\.linkedin\.com\/in\/matheussiqueira-dev" target="_blank" rel="noopener noreferrer">LinkedIn/);
  assert.match(html, /<a href="https:\/\/github\.com\/matheussiqueira-dev\/3D-hands" target="_blank" rel="noopener noreferrer">Código deste projeto/);
  assert.ok(html.includes(`3D Hands · v${pkg.version}</p>`));
});

test('page metadata names the author and the production URL', () => {
  assert.match(html, /<title>3D Hands \| Matheus Siqueira<\/title>/);
  assert.match(html, /<meta name="author" content="Matheus Siqueira">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/3-d-hands\.vercel\.app\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/3-d-hands\.vercel\.app\/og\.png">/);
  const description = html.match(/<meta name="description" content="([^"]+)">/)[1];
  assert.ok(description.length >= 140 && description.length <= 160, `description has ${description.length} chars`);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'WebApplication');
  assert.equal(ld.author.name, 'Matheus Siqueira');
  assert.equal(ld.codeRepository, 'https://github.com/matheussiqueira-dev/3D-hands');
});

test('package.json carries the standard author fields', () => {
  assert.equal(pkg.author, 'Matheus Siqueira <hellomatheusdev@gmail.com> (https://www.matheussiqueira.dev)');
  assert.equal(pkg.homepage, 'https://3-d-hands.vercel.app');
  assert.equal(pkg.license, 'MIT');
  assert.match(pkg.repository.url, /github\.com\/matheussiqueira-dev\/3D-hands/);
});

test('no personal phone or wrong demo domain anywhere in the page', () => {
  assert.doesNotMatch(html, /wa\.me|5581|3d-hands\.vercel\.app/);
});
