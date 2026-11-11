// Gera dist/ponto.html: o mesmo app, com cabeçalho próprio para a página isolada do professor (/ponto).
// Assim, "Adicionar à tela inicial" (Android e iPhone) já recebe o nome, o título e o manifesto corretos
// antes de qualquer JavaScript rodar.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('dist/index.html', 'utf8');
const trocas = [
  [/<title>[^<]*<\/title>/, '<title>Ponto do Professor – FEMAF</title>'],
  [/href="\/manifest\.webmanifest"/, 'href="/manifest-ponto.webmanifest"'],
  [/name="apple-mobile-web-app-title" content="[^"]*"/, 'name="apple-mobile-web-app-title" content="Ponto FEMAF"'],
];
for (const [de, para] of trocas) {
  if (!de.test(html)) throw new Error(`ponto-html: trecho não encontrado em dist/index.html: ${de}`);
  html = html.replace(de, para);
}
writeFileSync('dist/ponto.html', html);
console.log('dist/ponto.html gerado');
