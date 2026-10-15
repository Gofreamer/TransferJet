// Prévia local isolada: o SDK Firebase é substituído por dados de demonstração.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const firebaseMock = require('../tests/firebase-mock.cjs');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PREVIEW_PORT || 4173);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/__demo/firebase.js') {
      const seedContext = { window: {} };
      vm.runInNewContext(await fs.readFile(path.join(root, 'js/data/seed-market.js'), 'utf8'), seedContext);
      const { SEED_MARKET_PLAYERS: players, SEED_TRANSFERS: transfers, SEED_RUMORS: rumors } = seedContext.window;
      const rosters = {};
      for (const key of Object.keys(players)) {
        const divider = key.indexOf('_');
        const team = key.slice(0, divider);
        (rosters[team] ||= []).push({ n: key.slice(divider + 1), role: 'titular' });
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      const config = JSON.stringify({ players, rosters, transfers, rumors, season: 'Temporada 4' }).replace(/</g, '\\u003c');
      return res.end(`window.__testConfig=${config};(${firebaseMock.toString()})();`);
    }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (file !== 'index.html' && !/^(js|css)\/[\w./-]+\.(js|css)$/.test(file)) throw Error('not found');
    const target = path.resolve(root, file);
    if (!target.startsWith(root + path.sep)) throw Error('invalid path');
    let body = await fs.readFile(target, 'utf8');
    if (file === 'js/services/ai.js') {
      body += `\nwindow.marketGenerateWithAI = window.generateWithAI = async () => "IA de demonstração: esta prévia usa dados fictícios e não consulta o Gemini.";\nwindow.isAIReady = () => true;\nwindow.getLastAIError = () => null;`;
    }
    if (file === 'index.html') {
      body = body.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+firebase-app-compat\.js"><\/script>/, '<script src="/__demo/firebase.js"></script>')
        .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+firebase-(database|auth)-compat\.js"><\/script>/g, '')
        .replace('<body>', '<body><div class="demo-banner" role="status">PRÉVIA LOCAL · Dados fictícios · Sem conexão com os bancos de produção</div>');
    }
    res.writeHead(200, { 'Content-Type': `${file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Não encontrado'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Prévia local: http://127.0.0.1:${port} (dados fictícios; Firebase de produção isolado)`));
process.on('SIGINT', () => server.close(() => process.exit()));
process.on('SIGTERM', () => server.close(() => process.exit()));
