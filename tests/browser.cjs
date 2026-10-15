const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const firebaseMock = require('./firebase-mock.cjs');
const legacyFixture = require('./fixtures/club-legacy.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw Error('invalid path');
      const content = await fs.readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let passed = 0;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
    async function scenario(name, run, config = {}, viewport = { width: 1280, height: 720 }) {
      if (process.env.TEST_SCENARIO && !name.includes(process.env.TEST_SCENARIO)) return;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.dismiss());
      await page.addInitScript(value => {
        window.__testConfig = value;
        localStorage.setItem('fantasyParticipantId', 'human1');
        localStorage.setItem('fantasyDisplayName', 'Richard');
      }, config);
      await context.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith(origin + '/')) return route.continue();
        if (url.includes('firebase-app-compat')) return route.fulfill({ contentType: 'text/javascript', body: `(${firebaseMock.toString()})();` });
        if (config.aiMode && url.endsWith('/12.16.0/firebase-app.js')) return route.fulfill({
          contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
          body: `const apps=[]; export const getApps=()=>apps; export function initializeApp(config,name){const app={name};apps.push(app);return app;}`
        });
        if (config.aiMode && url.endsWith('/12.16.0/firebase-ai.js')) return route.fulfill({
          contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
          body: `export class GoogleAIBackend {} export const getAI=app=>app; export function getGenerativeModel(app,config){return {async generateContent(prompt,options){(window.__aiCalls||=[]).push({project:app.name,model:config.model}); await new Promise(resolve=>setTimeout(resolve,30)); if(window.__testConfig.aiMode==='quota') throw Error('429 RESOURCE_EXHAUSTED'); return {response:{text:()=> 'Análise simulada para revisão: Alice.'}};}};}`
        });
        if (/firebase-(database|auth)-compat|chart\.umd|xlsx\.full/.test(url)) return route.fulfill({ contentType: 'text/javascript', body: '' });
        return route.abort();
      });
      try {
        await run(page);
        assert.deepEqual(errors, [], 'Erros JavaScript');
        assert.equal(await page.evaluate(() => window.__writes.length), config.expectedWrites || 0, 'Escritas somente no mock e quando esperadas');
        passed++;
        console.log(`PASS ${name}`);
      } catch (error) {
        console.error(name, { url: page.url(), errors });
        throw error;
      } finally { await context.close(); }
    }
    async function ready(page, query = '') {
      await page.goto(origin + '/' + query);
      await page.waitForFunction(() => window.AppRouter && (window.AppState.ui.jetLoaded && window.AppState.ui.marketLoaded || window.__testConfig.offline || window.__testConfig.denied));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(() => document.fonts.ready);
    }
    async function view(page, name) {
      await page.waitForFunction(name => window.AppState.ui.currentView === name, name);
      assert.equal(await page.locator(`#view-${name}`).evaluate(el => !el.classList.contains('hidden')), true);
    }
    async function screenshot(page, name) {
      if (!process.env.SCREENSHOT_DIRECTORY) return;
      await fs.mkdir(process.env.SCREENSHOT_DIRECTORY, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIRECTORY, name + '.png'), fullPage: true, animations: 'disabled' });
    }
    async function noOverflow(page) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'A página não deve transbordar horizontalmente');
      assert.equal(await page.locator('.hero-stats:visible .stat-value').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1)), true, 'Indicadores não devem cortar valores');
    }

    await scenario('Início → Agentes → Perfil → Voltar/Avançar; filtros, rolagem e histórico sem duplicação', async page => {
      await ready(page);
      await page.locator('.nav a[data-view="players"]').click();
      await page.locator('#playerSearch').fill('Agent');
      await page.locator('#playerClubFilter').selectOption('Alpha');
      await page.evaluate(() => window.scrollTo(0, 550));
      await page.waitForFunction(() => history.state.scroll[1] > 0);
      const savedScroll = await page.evaluate(() => window.scrollY);
      // Clique sem o scrollIntoView automático do Playwright, preservando a posição testada.
      await page.locator('#playersList .card').first().evaluate(el => el.click());
      await view(page, 'player-profile');
      const historyLength = await page.evaluate(() => history.length);
      const playerURL = page.url();
      await page.evaluate(() => openPlayerProfile(window.AppState.ui.selectedPlayer.key));
      assert.equal(await page.evaluate(() => history.length), historyLength);
      await page.goBack();
      await view(page, 'players');
      assert.equal(await page.locator('#playerSearch').inputValue(), 'Agent');
      assert.equal(await page.locator('#playerClubFilter').inputValue(), 'Alpha');
      await page.waitForFunction(y => Math.abs(window.scrollY - y) < 3, savedScroll);
      await page.goBack();
      await view(page, 'home');
      assert.equal(new URL(page.url()).searchParams.has('player'), false);
      await page.goForward();
      await view(page, 'players');
      await page.goForward();
      await view(page, 'player-profile');
      assert.equal(page.url(), playerURL);
    });

    await scenario('links diretos de agente aguardam Jet League e sobrevivem ao reload', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.waitForFunction(() => document.querySelector('#playerProfileContent h1')?.textContent === 'Alice');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#playerProfileContent h1')?.textContent === 'Alice');
      assert.equal(new URL(page.url()).searchParams.get('player'), 'Alpha_Alice');
      await page.evaluate(() => showView('clubs'));
      assert.equal(new URL(page.url()).searchParams.has('player'), false);
    }, { jetDelay: 150, marketDelay: 5 });

    await scenario('reload restaura rolagem depois que os dados assíncronos preenchem a lista', async page => {
      await ready(page, '?view=players');
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForFunction(() => history.state.scroll[1] === 900);
      await page.reload();
      await page.waitForFunction(() => window.AppState.ui.jetLoaded && window.AppState.ui.marketLoaded);
      await page.waitForFunction(() => Math.abs(window.scrollY - 900) < 3);
    }, { jetDelay: 150, marketDelay: 80 });

    await scenario('perfil e filtros carregam com Market atrasado; equipe tem link direto', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.waitForFunction(() => document.querySelector('#playerProfileContent .big-value')?.textContent.includes('20.000.000'));
      await page.evaluate(() => openClubProfile('Alpha'));
      assert.equal(new URL(page.url()).searchParams.get('club'), 'Alpha');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#clubProfileContent h1')?.textContent === 'Alpha');
      await page.goto(origin + '/?view=players&f.playerSearch=Bob&f.playerClubFilter=Beta');
      await page.waitForFunction(() => window.AppState.ui.marketLoaded && window.AppState.ui.jetLoaded);
      assert.equal(await page.locator('#playersList .card').count(), 1);
      assert.match(await page.locator('#playersList').innerText(), /Bob/);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#playersList .card-title')?.textContent === 'Bob');
    }, { jetDelay: 5, marketDelay: 150 });

    await scenario('todas as seções e páginas Fantasy; sessão restaurada, filtros e retorno do perfil', async page => {
      await ready(page);
      for (const name of ['compare', 'transfers', 'rumors', 'rankings', 'clubs', 'home']) {
        await page.locator(`.nav a[data-view="${name}"]`).click();
        await view(page, name);
      }
      await page.evaluate(() => enterFantasyMode());
      await page.waitForFunction(() => window.AppState.fantasy.active);
      assert.equal(await page.evaluate(() => getMyFantasyParticipant()?.displayName), 'Richard');
      for (const name of ['squad', 'ranking', 'rounds', 'hub', 'market']) {
        await page.locator(`.fx-nav-btn[onclick="showFantasyView('${name}')"]`).click();
        assert.equal(new URL(page.url()).searchParams.get('fantasy'), name);
      }
      await page.locator('#fxFilterQ').fill('Alice');
      await page.evaluate(() => fxOpenPlayerProfile('Alpha_Alice'));
      await view(page, 'player-profile');
      assert.equal(await page.evaluate(() => window.AppState.fantasy.active), false);
      await page.goBack();
      await page.waitForFunction(() => window.AppState.fantasy.active);
      assert.equal(await page.locator('#fxFilterQ').inputValue(), 'Alice');
      await page.reload();
      await page.waitForFunction(() => document.getElementById('fxFilterQ')?.value === 'Alice');
      await page.evaluate(() => exitFantasyMode());
      await view(page, 'home');
      assert.equal(new URL(page.url()).searchParams.has('fantasy'), false);
    });

    await scenario('transferência atualiza UI e mantém perfil e preço Fantasy usando a chave antiga', async page => {
      await ready(page, '?player=Alpha_Alice');
      const before = await page.evaluate(() => playerPrice('Alpha_Alice'));
      await page.evaluate(() => recordTransfer({ playerKey: 'Alpha_Alice', playerName: 'Alice', from: 'Alpha', to: 'Beta', fee: 5, status: 'oficial', type: 'definitiva' }, getAllPlayersFlat().find(p => p.key === 'Alpha_Alice')));
      assert.equal(await page.evaluate(() => getAllPlayersFlat().filter(p => p.name === 'Alice').length), 1);
      assert.equal(await page.evaluate(() => getAllPlayersFlat().find(p => p.key === 'Alpha_Alice').club), 'Beta');
      assert.equal(await page.evaluate(() => playerPrice('Alpha_Alice')), before);
      assert.match(await page.locator('#playerProfileContent .profile-meta').innerText(), /Beta/);
      assert.equal(await page.evaluate(() => __writes[0].updates['transfers/mock-transfer-1'].playerId), 'legacy:Alpha_Alice');
    }, { expectedWrites: 1 });

    await scenario('banco vazio não executa seeds ao navegar nem ao abrir Fantasy', async page => {
      await ready(page, '?view=players');
      await page.evaluate(() => enterFantasyMode());
      await page.waitForFunction(() => window.AppState.fantasy.active);
      assert.equal(await page.evaluate(() => Object.keys(window.AppState.market.players).length), 0);
    }, { empty: true });

    await scenario('sem Firebase, links permanecem navegáveis e carregamento não lança exceções', async page => {
      await ready(page, '?player=Alpha_Alice');
      assert.match(await page.locator('#playerProfileContent').innerText(), /Aguardando/);
      await page.evaluate(() => showView('players'));
      await view(page, 'players');
      await page.evaluate(() => enterFantasyMode());
      assert.equal(await page.evaluate(() => window.AppState.fantasy.active), true);
    }, { offline: true });

    await scenario('acesso negado é mostrado no estado de conexão', async page => {
      await ready(page);
      await page.waitForFunction(() => window.AppState.ui.marketError === 'permission_denied');
      assert.equal(await page.locator('#connectionStatus').getAttribute('title'), 'permission_denied');
    }, { denied: true });

    await scenario('links codificados não são decodificados duas vezes; mobile navega entre módulos', async page => {
      await ready(page, '?player=100%25_inexistente');
      assert.match(await page.locator('#playerProfileContent').innerText(), /não encontrado/);
      await page.evaluate(() => showView('players'));
      await page.locator('#playerSearch').fill('Alice');
      await page.locator('#playersList .card').click();
      await view(page, 'player-profile');
      await page.goBack();
      await view(page, 'players');
      assert.equal(await page.locator('#playerSearch').inputValue(), 'Alice');
      await page.evaluate(() => enterFantasyMode());
      await page.locator('.fx-nav-btn[onclick="showFantasyView(\'market\')"]').click();
      assert.equal(new URL(page.url()).searchParams.get('fantasy'), 'market');
    }, {}, { width: 390, height: 844 });

    const specialName = 'O\'Neil " & <img src=x onerror="window.__xss=1">';
    await scenario('nomes, fotos e chaves especiais são escapados sem quebrar a abertura do perfil', async page => {
      await ready(page, '?view=players');
      await page.locator('#playerSearch').fill("O'Neil");
      assert.equal(await page.locator('#playersList .card-title').innerText(), specialName);
      await page.locator('#playersList .card').click();
      await view(page, 'player-profile');
      assert.equal(await page.locator('#playerProfileContent h1').innerText(), specialName);
      assert.equal(new URL(page.url()).searchParams.get('player'), 'Alpha_O\'Neil " & Friends');
      assert.equal(await page.evaluate(() => window.__xss), undefined);
      assert.equal(await page.locator('#playerProfileContent img[src="x"]').count(), 0);
      await page.evaluate(() => openClubProfile('<img src=x onerror="window.__xss=1">'));
      assert.equal(await page.locator('#clubProfileContent h1').textContent(), '<img src=x onerror="window.__xss=1">');
      assert.equal(await page.evaluate(() => window.__xss), undefined);
    }, { specialName });

    await scenario('dashboard e listas nos temas claro/escuro; navegação por teclado e gráfico indisponível', async page => {
      await ready(page);
      await noOverflow(page);
      assert.equal(await page.locator('.nav [aria-current="page"]').getAttribute('data-view'), 'home');
      await screenshot(page, 'dashboard-dark');
      await page.locator('#themeToggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await screenshot(page, 'dashboard-light');
      await page.reload();
      await page.waitForFunction(() => window.AppState.ui.jetLoaded && window.AppState.ui.marketLoaded);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await page.locator('.nav a[data-view="players"]').click();
      await noOverflow(page);
      await screenshot(page, 'agents-light');
      await page.locator('#playerSearch').fill('Alice');
      await page.locator('#playersList .card').first().focus();
      await page.keyboard.press('Enter');
      await view(page, 'player-profile');
      await page.waitForSelector('.chart-state');
      assert.equal(await page.locator('.chart-state strong').innerText(), 'Histórico ainda indisponível');
      await page.locator('#historySource').selectOption('legacy');
      assert.equal(await page.locator('.chart-state strong').innerText(), 'O gráfico não carregou');
      await noOverflow(page);
      await screenshot(page, 'profile-light');
      assert.equal(await page.locator('.nav [aria-current="page"]').getAttribute('data-view'), 'players');
    });

    await scenario('menu mobile com teclado, foco, filtros, tabelas e modais sem transbordamento', async page => {
      await ready(page);
      await noOverflow(page);
      await screenshot(page, 'mobile-home');
      assert.equal(await page.locator('#siteNavigation').evaluate(el => el.inert), true);
      await page.locator('#menuToggle').click();
      assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'themeToggle');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('logo')), true);
      await screenshot(page, 'mobile-menu');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'menuToggle');
      await page.locator('#menuToggle').click();
      await page.locator('.nav a[data-view="players"]').click();
      await view(page, 'players');
      assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'false');
      await page.locator('#playerSearch').fill('Alice');
      await noOverflow(page);
      await screenshot(page, 'mobile-agents');
      await page.locator('#playersList .card').click();
      await view(page, 'player-profile');
      await page.waitForSelector('.chart-state');
      await noOverflow(page);
      await screenshot(page, 'mobile-profile');
      await page.evaluate(() => { openAdmin(); renderAdminPanel('transfers'); });
      await noOverflow(page);
      assert.equal(await page.locator('#adminBox').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
      await screenshot(page, 'mobile-admin');
      await page.evaluate(() => closeAdmin());
      await page.locator('#menuToggle').click();
      await page.locator('#themeToggle').click();
      await page.keyboard.press('Escape');
      await screenshot(page, 'mobile-light');
      await page.evaluate(() => enterFantasyMode());
      assert.equal(await page.locator('.workspace-bar').isVisible(), false);
    }, {}, { width: 390, height: 844 });

    await scenario('carregamento e conexão indisponível ficam explícitos no celular', async page => {
      await ready(page, '?view=players');
      assert.equal(await page.locator('#dataNotice').isVisible(), true);
      assert.match(await page.locator('#dataNotice').innerText(), /Carregando/);
      await page.locator('#menuToggle').click();
      await page.locator('.nav a[data-view="home"]').click();
      await noOverflow(page);
      await screenshot(page, 'mobile-offline');
    }, { offline: true }, { width: 320, height: 740 });

    await scenario('revisão administrativa salva dois valores reais sem reescrever histórico antigo', async page => {
      await ready(page);
      await page.evaluate(() => { openAdmin(); renderAdminPanel('values'); });
      const row = page.locator('tr[data-key="Alpha_Alice"]');
      await row.locator('[data-field="marketValue"]').fill('21000000');
      await row.locator('button').click();
      assert.equal(await page.locator('#marketEditDialog').isVisible(), true);
      assert.equal(await page.evaluate(() => __writes.length), 0);
      await page.locator('#marketCancelEdit').click();
      assert.equal(await page.evaluate(() => __writes.length), 0);
      await row.locator('button').click();
      await page.locator('#marketConfirmEdit').click();
      await page.waitForFunction(() => !document.getElementById('marketEditDialog').open);
      await row.locator('[data-field="marketValue"]').fill('22000000');
      await row.locator('button').click();
      await page.locator('#marketConfirmEdit').click();
      await page.waitForFunction(() => !document.getElementById('marketEditDialog').open);
      assert.equal(await page.evaluate(() => Market.events(AppState.market.players.Alpha_Alice).length), 2);
      assert.equal(await page.evaluate(() => AppState.market.players.Alpha_Alice.valueHistory.length), 2);
      await page.evaluate(() => { closeAdmin(); openPlayerProfile('Alpha_Alice'); });
      await page.waitForSelector('#marketHistoryRows tbody tr');
      assert.equal(await page.locator('#marketHistoryRows tbody tr').count(), 2);
      assert.match(await page.locator('.variation-line').innerText(), /última alteração registrada/);
      await screenshot(page, 'market-history');
      await page.locator('#historySource').selectOption('legacy');
      assert.match(await page.locator('#historyOrigin').innerText(), /estimativas fictícias/);
      await noOverflow(page);
    }, { expectedWrites: 2 });

    await scenario('filtros de status combinados e comparação com empates e agentes distintos', async page => {
      await ready(page, '?view=players');
      await page.evaluate(() => { __mockData.market.players.Alpha_Alice.status = 'suspenso'; __mockData.market.players.Beta_Bob.marketValue = 20000000; __mockEmit(); });
      await page.locator('#playerSearch').fill('alice');
      await page.locator('#playerClubFilter').selectOption('Alpha');
      await page.locator('#playerRankFilter').selectOption('Rank A');
      await page.locator('#playerStatusFilter').selectOption('suspenso');
      await page.locator('#playerValueFilter').selectOption('20-30');
      assert.equal(await page.locator('#playersList .card').count(), 1);
      await page.locator('#playersList .card').click();
      await page.goBack();
      await view(page, 'players');
      assert.equal(await page.locator('#playerStatusFilter').inputValue(), 'suspenso');
      await page.evaluate(() => showView('compare'));
      await page.locator('#compareA').selectOption('Alpha_Alice');
      await page.locator('#compareB').selectOption('Beta_Bob');
      assert.equal(await page.locator('#compareResult tbody tr').first().locator('td[style*="700"]').count(), 2);
      assert.match(await page.locator('#compareResult').innerText(), /Salário/);
      await noOverflow(page);
      await screenshot(page, 'market-compare');
      assert.equal(await page.locator('#compareResult .table-wrap').evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft > 0; }), true);
      await page.locator('#compareC').selectOption('Alpha_Alice');
      assert.match(await page.locator('#compareResult').innerText(), /diferentes/);
      await page.evaluate(() => showView('rankings'));
      await page.locator('#rankingType').selectOption('players-gain');
      assert.match(await page.locator('#rankingsList').innerText(), /Nenhuma variação real/);
    }, {}, { width: 390, height: 844 });

    await scenario('importação revisada mantém preços por padrão e conserva chave após renomear e transferir', async page => {
      await ready(page);
      await page.evaluate(() => { openAdmin(); renderAdminPanel('import'); });
      assert.equal(await page.locator('input[name="importMode"]:checked').inputValue(), 'statsOnly');
      await page.evaluate(() => {
        const rows = calculateValuesFromRows([{ ID: 'legacy:Alpha_Alice', Equipe: 'Beta', Agente: 'Alicia', Rank: 'Rank A', P: 10, V: 8, D: 2 }]);
        showImportReviewModal(rows, 'statsOnly');
      });
      await page.locator('#aiReviewModal .btn-primary').click();
      await page.waitForFunction(() => __writes.length === 1);
      assert.equal(await page.evaluate(() => AppState.market.players.Alpha_Alice.marketValue), 20000000);
      assert.equal(await page.evaluate(() => AppState.market.players.Alpha_Alice.name), 'Alicia');
      assert.equal(await page.evaluate(() => AppState.market.players.Beta_Alicia), undefined);
      await page.evaluate(() => {
        const rows = calculateValuesFromRows([{ ID: 'legacy:Alpha_Alice', Equipe: 'Beta', Agente: 'Alicia', Rank: 'Rank A', P: 10, V: 8, D: 2 }]);
        showImportReviewModal(rows, 'full');
      });
      await page.locator('.imp-val').fill('33000000');
      await page.locator('#aiReviewModal .btn-primary').click();
      await page.waitForFunction(() => __writes.length === 2);
      assert.equal(await page.evaluate(() => AppState.market.players.Alpha_Alice.marketValue), 33000000);
      assert.equal(await page.evaluate(() => Market.events(AppState.market.players.Alpha_Alice).length), 1);
      assert.equal(await page.evaluate(() => Market.events(AppState.market.players.Alpha_Alice)[0].source), 'import');
    }, { expectedWrites: 2 });

    await scenario('carreira considera somente transferências oficiais identificadas', async page => {
      await ready(page, '?player=Alpha_Alice');
      assert.equal(await page.locator('.transfer-timeline li').count(), 1);
      assert.match(await page.locator('.transfer-timeline').innerText(), /Beta.*→.*Alpha/);
      assert.doesNotMatch(await page.locator('.transfer-timeline').innerText(), /Gamma/);
      await screenshot(page, 'market-timeline');
    }, { transfers: {
      t1: { playerId: 'legacy:Alpha_Alice', playerKey: 'Alpha_Alice', playerName: 'Alice', status: 'oficial', from: 'Beta', to: 'Alpha', fee: 1000000, date: '2026-01-01', season: 'T2' },
      t2: { playerKey: 'Alpha_Alice', playerName: 'Alice', status: 'negociando', from: 'Alpha', to: 'Gamma', fee: 2000000, date: '2026-02-01' }
    } });

    await scenario('backup exporta JSON e restaura apenas registro ausente, sem sobrescrever existente', async page => {
      await ready(page);
      await page.evaluate(() => { openAdmin(); renderAdminPanel('backup'); });
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Baixar backup JSON' }).click();
      const download = await downloadPromise;
      const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
      assert.equal(backup.format, 'transferjet-market');
      assert.equal(backup.data.players.Alpha_Alice.marketValue, 20000000);
      const file = { format: 'transferjet-market', version: 1, data: { players: {
        Alpha_Alice: { name: 'Alice', marketValue: 1 },
        New_Carol: { name: 'Carol', team: 'New', id: 'carol1', marketValue: 1500000, status: 'ativo' }
      } } };
      await page.locator('#marketBackupFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
      await page.waitForSelector('#marketRestoreChoice');
      await page.locator('#marketRestoreChoice').selectOption({ label: 'players/Alpha_Alice' });
      await page.locator('#marketRestoreConfirm').click();
      await page.waitForFunction(() => document.getElementById('marketRestoreResult').textContent.includes('já existe'));
      assert.equal(await page.evaluate(() => __writes.length), 0);
      await page.locator('#marketRestoreChoice').selectOption({ label: 'players/New_Carol' });
      await page.locator('#marketRestoreConfirm').click();
      await page.waitForFunction(() => __writes.length === 1);
      assert.equal(await page.evaluate(() => AppState.market.players.Alpha_Alice.marketValue), 20000000);
      assert.equal(await page.evaluate(() => AppState.market.players.New_Carol.name), 'Carol');
    }, { expectedWrites: 1 });

    await scenario('Fantasy: filtros, compra, capitão, limite de equipe e troca com custo líquido', async page => {
      await ready(page, '?fantasy=market');
      await page.waitForSelector('#fxMarketGrid .fx-card');
      await page.locator('#fxFilterRank').selectOption('Rank B');
      assert.equal(await page.locator('#fxMarketGrid .fx-card').count(), 1);
      await page.locator('#fxFilterMax').fill('50000');
      assert.match(await page.locator('#fxMarketGrid').innerText(), /Nenhum agente/);
      await page.locator('#fxFilterMax').fill('');
      await page.locator('#fxFilterRank').selectOption('');
      const alice = page.locator('#fxMarketGrid [data-key="Alpha_Alice"]');
      await alice.getByRole('button', { name: 'Escalar', exact: true }).click();
      await page.waitForFunction(() => AppState.fantasy.participants.human1.squad.starters[0] === 'Alpha_Alice');
      assert.equal(await page.evaluate(() => getMyFantasyParticipant().budgetRemaining), 3000000);
      await page.evaluate(() => fxCaptain('Alpha_Alice'));
      assert.equal(await page.evaluate(() => getMyFantasyParticipant().squad.captainKey), 'Alpha_Alice');
      await page.locator('#fxMarketGrid [data-key="Alpha_Agent 0"]').getByRole('button', { name: 'Escalar', exact: true }).click();
      await page.waitForFunction(() => getMyFantasyParticipant().squad.starters[1] === 'Alpha_Agent 0');
      await page.waitForFunction(() => !window._fxSquadBusy);
      const blocked = page.locator('#fxMarketGrid [data-key="Alpha_Agent 1"]');
      assert.equal(await blocked.getByRole('button', { name: 'Escalar', exact: true }).isDisabled(), true);
      assert.match(await blocked.innerText(), /Máximo 2/);
      await page.evaluate(() => fxOpenMarketForSlot(0));
      assert.equal(await blocked.getByRole('button', { name: 'Escalar', exact: true }).isEnabled(), true);
      assert.match(await blocked.innerText(), /Custo líquido/);
      await page.locator('#fxFilterAvailability').selectOption('selected');
      assert.equal(await page.locator('#fxMarketGrid .fx-card').count(), 2);
      await screenshot(page, 'fantasy-market'); await noOverflow(page);
    }, { expectedWrites: 3 });

    const fantasyPlayers = {}; const fantasyRosters = {};
    for (let i = 0; i < 9; i++) {
      const club = 'Team ' + Math.floor(i / 2); const name = 'Agent ' + i;
      (fantasyRosters[club] ||= []).push({ n: name, role: 'titular' });
      fantasyPlayers[club + '_' + name] = { id: 'id' + i, name, team: club, marketValue: 1000000, status: 'ativo', rank: 'A' };
    }
    await scenario('Fantasy: fechamento oficial, revisão, confirmação repetida, ranking, histórico e análise revisada', async page => {
      await ready(page, '?fantasy=squad');
      await page.waitForFunction(() => AppState.fantasy.ui.participantsLoaded);
      await page.evaluate(async () => {
        const keys = Object.keys(__mockData.market.players);
        __mockData.market.fantasy.participants.human1.squad = { starters: keys.slice(0,5), bench: keys[5], captainKey: keys[0] };
        __mockData.market.fantasy.participants.human1.budgetRemaining = 4400000;
        __mockData.market.fantasy.settings.geminiEnabled = false;
        __mockData.jet.liga.matches = { m1: { temporada: 'T2', rodada: 1, timeA: 'Team 0', timeB: 'Team 1', scoreA: 2, scoreB: 0, fights: [{ teamA: ['Agent 0', 'Agent 1'], teamB: ['Agent 2', 'Agent 3'] }], seriesMvp: { agent: 'Agent 0' }, destaqueRodada: 'Agent 0' } };
        __mockEmit();
        await fxAdminCloseMarket();
      });
      assert.equal(await page.evaluate(() => __writes.length), 2);
      assert.equal(await page.evaluate(() => __mockData.market.fantasy.rounds.r1.snapshot.participants.human1.valid), true);
      await page.evaluate(async () => {
        __mockData.market.players['Team 0_Agent 0'].name = 'Nome novo';
        __mockData.market.players['Team 0_Agent 0'].team = 'Team 4';
        __mockData.market.fantasy.participants.human1.squad.captainKey = 'Team 0_Agent 1';
        __mockEmit(); await fxAdminPreviewProcess();
      });
      assert.equal(await page.locator('#aiReviewOverlay').evaluate(el => el.classList.contains('open')), true);
      assert.match(await page.locator('#aiReviewBody').innerText(), /27/);
      await page.evaluate(() => confirmAIReview());
      await page.waitForFunction(() => __mockData.market.fantasy.rounds.r1.status === 'PROCESSED');
      assert.equal(await page.evaluate(() => __writes.length), 4);
      await page.evaluate(async () => { await fxAdminPreviewProcess(); await fxAdminOpenMarket(); await fxAdminCloseMarket(); });
      assert.equal(await page.evaluate(() => __writes.length), 4);
      await page.evaluate(() => showFantasyView('ranking'));
      assert.match(await page.locator('.fx-rank-row.me').innerText(), /27/);
      assert.equal(await page.locator('.fx-evolution svg').count(), 1);
      await page.getByRole('button', { name: 'Rodada', exact: true }).click();
      assert.equal(await page.locator('[aria-label="Rodada do ranking"]').inputValue(), 'r1');
      await screenshot(page, 'fantasy-ranking');
      await page.evaluate(() => showFantasyView('rounds'));
      await page.locator('.fx-round-card summary').click();
      assert.match(await page.locator('.fx-score-details').innerText(), /Agent 0/);
      assert.equal(await page.locator('.fx-score-details').innerText().then(text => text.includes('Nome novo')), false);
      await page.evaluate(() => fxAdminReviewAnalysis());
      assert.equal(await page.locator('#fxAnalysisDraft').count(), 1);
      assert.equal(await page.evaluate(() => __writes.length), 4, 'rascunho sem escrita');
      await page.locator('#fxAnalysisDraft').fill('Análise revisada: Richard marcou 27 pontos.');
      await page.evaluate(() => confirmAIReview());
      await page.waitForFunction(() => __mockData.market.fantasy.rounds.r1.analysisCache?.source === 'reviewed');
      await page.evaluate(() => showFantasyView('rounds'));
      assert.match(await page.locator('.fx-analysis').innerText(), /Richard marcou 27/);
      await noOverflow(page); await screenshot(page, 'fantasy-rounds');
    }, { players: fantasyPlayers, rosters: fantasyRosters, expectedWrites: 5 }, { width: 390, height: 844 });

    await scenario('Fantasy: agentes indisponíveis não aparecem e nomes especiais permanecem texto', async page => {
      await ready(page, '?fantasy=market');
      await page.waitForSelector('#fxMarketGrid .fx-card');
      await page.evaluate(() => { __mockData.market.players.Alpha_Alice.status = 'suspenso'; __mockData.market.players.Beta_Bob.fantasyEligible = false; __mockEmit(); });
      await page.waitForFunction(() => !document.querySelector('#fxMarketGrid [data-key="Alpha_Alice"]'));
      assert.equal(await page.locator('#fxMarketGrid [data-key="Alpha_Alice"]').count(), 0);
      assert.equal(await page.locator('#fxMarketGrid [data-key="Beta_Bob"]').count(), 0);
      assert.equal(await page.evaluate(() => window.__xss || 0), 0);
      await noOverflow(page);
    }, { specialName: '<img src=x onerror="window.__xss=1">' }, { width: 320, height: 740 });

    await scenario('Otimização: Fantasy sob demanda, atualizações agrupadas e nick preservado durante digitação', async page => {
      await ready(page);
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 11, 'Fantasy não lê ao abrir mercado');
      await page.evaluate(() => {
        window.__paints = 0; const refresh = AppRouter.refresh;
        AppRouter.refresh = (...args) => { window.__paints++; return refresh(...args); };
        for (let i=0; i<5; i++) document.dispatchEvent(new CustomEvent('fantasy:updated'));
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => __paints), 0, 'Fantasy inativo não redesenha o mercado');
      await page.evaluate(() => { for (let i=0; i<10; i++) __mockEmit(); });
      await page.waitForFunction(() => __paints === 1);
      await page.evaluate(() => enterFantasyMode());
      await page.waitForFunction(() => AppState.fantasy.ui.participantsLoaded);
      await page.evaluate(() => fantasyLogout());
      await page.locator('#fxLoginInput').fill('Richard');
      await page.locator('#fxLoginInput').evaluate(el => { el.focus(); el.setSelectionRange(2,4); });
      await page.evaluate(() => { window.__paints = 0; for (let i=0; i<10; i++) __mockEmit(); });
      await page.waitForFunction(() => __paints === 1);
      assert.equal(await page.locator('#fxLoginInput').inputValue(), 'Richard');
      assert.deepEqual(await page.locator('#fxLoginInput').evaluate(el => [el === document.activeElement, el.selectionStart, el.selectionEnd]), [true, 2, 4]);
      await page.locator('#fxContent').getByRole('button', { name: 'Entrar', exact: true }).click();
      assert.equal(await page.evaluate(() => getMyFantasyParticipant().displayName), 'Richard');
      await page.evaluate(() => { showFantasyView('market'); showFantasyView('squad'); });
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 16);
      await page.evaluate(() => stopDataListeners());
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 0);
    });

    await scenario('Otimização: aba administrativa carrega Fantasy e preserva edição em andamento', async page => {
      await ready(page);
      await page.evaluate(() => { openAdmin(); renderAdminPanel('fantasy'); });
      await page.waitForSelector('#fxBudget');
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 16);
      await page.locator('#fxBudget').fill('3500000');
      await page.evaluate(() => __mockEmit());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#fxBudget').inputValue(), '3500000');
      await page.evaluate(() => closeAdmin());
    });

    await scenario('Otimização: Fantasy informa leitura negada e recupera pelo botão sem duplicar listeners', async page => {
      await ready(page, '?fantasy=hub');
      await page.waitForSelector('#fxContent .fx-state-card');
      assert.match(await page.locator('#fxContent').innerText(), /Não foi possível carregar/);
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 15);
      await page.evaluate(() => { __testConfig.fantasyDenied = false; });
      await page.locator('#fxContent').getByRole('button', { name: 'Tentar novamente' }).click();
      await page.waitForSelector('.fx-hub');
      assert.equal(await page.evaluate(() => __mockSubscriptions.length), 16);
      await noOverflow(page);
    }, { fantasyDenied: true }, { width: 320, height: 740 });

    await scenario('Otimização: Gemini compartilha chamada real do SDK simulado e exige revisão manual', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.evaluate(() => Promise.all([requestMarketAnalysis('Alpha_Alice'), requestMarketAnalysis('Alpha_Alice')]));
      assert.equal(await page.evaluate(() => __aiCalls.length), 1);
      assert.equal(await page.locator('#aiReviewOverlay').evaluate(el => el.classList.contains('open')), true);
      assert.equal(await page.evaluate(() => __writes.length), 0);
      await page.locator('#aiReviewOverlay').getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await page.locator('#marketAnalysisText').innerText().then(text => text.includes('Análise simulada')), false);
      await page.evaluate(() => requestMarketAnalysis('Alpha_Alice'));
      await page.locator('#revAnalysisText').fill('Texto editado e revisado.');
      await page.locator('#aiReviewOverlay').getByRole('button', { name: 'Confirmar e publicar', exact: true }).click();
      assert.equal(await page.locator('#marketAnalysisText').innerText(), 'Texto editado e revisado.');
      assert.equal(await page.evaluate(() => __aiCalls.length), 2);
    }, { aiMode: 'success' });

    await scenario('Otimização: quota Gemini tem mensagem clara e mantém o site navegável', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.evaluate(() => requestMarketAnalysis('Alpha_Alice'));
      assert.match(await page.locator('#marketAnalysisText').innerText(), /Limite de uso/);
      assert.equal(await page.evaluate(() => __aiCalls.length), 2);
      await page.evaluate(() => requestMarketAnalysis('Alpha_Alice'));
      assert.equal(await page.evaluate(() => __aiCalls.length), 2, 'pausa evita chamadas repetidas');
      await page.evaluate(() => showView('players'));
      await page.locator('#playerSearch').fill('Alice');
      assert.equal(await page.locator('#playersList .card').count(), 1);
    }, { aiMode: 'quota' });

    await scenario('Premium: busca global abre agentes e equipes pelo teclado e preserva navegação', async page => {
      await ready(page);
      await page.keyboard.press('/');
      assert.equal(await page.locator('#globalSearch').evaluate(el => el === document.activeElement), true);
      await page.locator('#globalSearch').fill('a');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator('#globalSearch').getAttribute('aria-activedescendant'), 'global-result-7');
      await page.locator('#globalSearch').fill('áLice');
      assert.equal(await page.locator('#globalSearchResults [role="option"]').count(), 1);
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('#globalSearch').getAttribute('aria-activedescendant'), 'global-result-0');
      await page.keyboard.press('Enter'); await view(page, 'player-profile');
      assert.equal(await page.evaluate(() => AppState.ui.selectedPlayer.key), 'Alpha_Alice');
      await page.goBack(); await view(page, 'home');
      await page.locator('#globalSearch').fill('Alice');
      await page.locator('#globalSearch').fill('');
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).searchParams.has('player'), false);
      await page.locator('#globalSearch').fill('Alpha');
      await page.locator('#globalSearchResults [role="option"]').click(); await view(page, 'club-profile');
      assert.match(await page.locator('#clubProfileContent').textContent(), /Alpha/);
      await page.goBack(); await view(page, 'home');
      await page.locator('#globalSearch').fill('não existe');
      assert.match(await page.locator('#globalSearchResults').innerText(), /Nenhum agente ou equipe/);
      await page.keyboard.press('Escape');
      await page.evaluate(() => __mockEmit());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#globalSearchResults').isVisible(), false);
      const bounds = await page.locator('#connectionStatus').boundingBox();
      assert.ok(bounds.y + bounds.height <= 720, 'conexão visível na lateral');
      await noOverflow(page);
    });

    await scenario('Premium: dashboard usa registros reais, distingue negociações e escapa rumores', async page => {
      await ready(page);
      await page.evaluate(() => {
        const p = __mockData.market.players.Alpha_Alice;
        p.marketValue = 21000000;
        p.valueEvents = { v1: { kind: 'recorded', at: 10, value: 21000000, previousValue: 20000000, source: 'manual', season: 'T2' } };
        __mockData.market.transfers = {
          t1: { playerKey: 'Alpha_Alice', playerName: 'Alice', from: 'Alpha', to: 'Beta', fee: 5000000, status: 'oficial', date: '2026-10-15' },
          t2: { playerKey: 'Beta_Bob', playerName: 'Bob', from: 'Beta', to: 'Alpha', fee: 2000000, status: 'negociando', date: '2026-10-14' }
        };
        __mockData.market.rumors = { r1: { playerName: 'Bob', interestedClub: '<img src=x onerror="window.__xss=1">', currentClub: 'Beta', description: '<script>window.__xss=1</script>', reliability: 70, status: 'interesse', date: '2026-10-15' } };
        __mockEmit();
      });
      await page.waitForFunction(() => document.querySelectorAll('.transfer-row').length === 2);
      assert.equal(await page.locator('#statTransfers').innerText(), '2');
      assert.equal(await page.locator('.deal-status.official').count(), 1);
      assert.equal(await page.locator('.deal-status.pending').count(), 1);
      assert.equal(await page.locator('.spotlight-info h3').innerText(), 'Alice');
      assert.match(await page.locator('.spotlight-info .movement-chip').innerText(), /5/);
      assert.equal(await page.locator('.news-row img, .news-row script').count(), 0);
      assert.equal(await page.evaluate(() => window.__xss || 0), 0);
      await screenshot(page, 'premium-records');
      await page.locator('.spotlight-info [data-premium-player]').click(); await view(page, 'player-profile');
      await page.goBack(); await view(page, 'home');
      await page.locator('.btn-fantasy').click();
      await page.waitForSelector('.fx-hub');
    });

    await scenario('Premium: busca e dashboard cabem no celular com todos os destinos funcionais', async page => {
      await ready(page);
      await page.locator('#globalSearch').fill('Bob');
      await noOverflow(page); await screenshot(page, 'premium-mobile-search');
      await page.locator('#globalSearchResults [role="option"]').click(); await view(page, 'player-profile');
      await page.goBack(); await view(page, 'home');
      await page.evaluate(() => window.scrollTo(0,0));
      await noOverflow(page); await screenshot(page, 'premium-mobile');
    }, {}, { width: 360, height: 800 });

    await scenario('Perfis: visitante não edita e administrador altera cadastro, contrato e passagem externa com revisão', async page => {
      await ready(page, '?player=Alpha_Alice');
      assert.equal(await page.locator('#editAgentProfile').count(), 1);
      const original = await page.evaluate(() => ({ jet: JSON.stringify(__mockData.jet), fantasy: JSON.stringify(__mockData.market.fantasy), value: __mockData.market.players.Alpha_Alice.marketValue }));
      const length = await page.evaluate(() => history.length);
      await page.locator('#editAgentProfile').click();
      await page.locator('[data-field="nationality"]').fill('Japão');
      await page.evaluate(() => __mockEmit());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('[data-field="nationality"]').inputValue(), 'Japão');
      await page.locator('[data-tab="contract"]').click();
      await page.locator('[data-field="contractMode"]').selectOption('fixed');
      await page.locator('[data-field="contractStart"]').fill('C.2');
      await page.locator('[data-field="contractUntil"]').fill('C.4');
      await page.locator('[data-field="salary"]').fill('50000');
      await page.locator('[data-tab="career"]').click();
      await page.locator('[data-action="add-history"]').click();
      await page.locator('[data-history-field="teamKind"]').selectOption('external');
      await page.locator('[data-history-field="teamName"]').fill('Internacional FC');
      await page.locator('[data-history-field="fromCycle"]').fill('C.1');
      await page.locator('[data-history-field="toCycle"]').fill('C.2');
      await page.locator('#peReviewBtn').click();
      assert.equal(await page.evaluate(() => __writes.length), 0);
      assert.match(await page.locator('#peReview').innerText(), /Internacional FC/);
      await page.locator('#peSaveBtn').click();
      await page.waitForFunction(() => !document.getElementById('profileEditorDialog').open);
      assert.equal(await page.evaluate(() => __mockData.market.players.Alpha_Alice.contractUntil), 'C.4');
      assert.equal(await page.evaluate(() => __mockData.market.players.Alpha_Alice.team), undefined);
      assert.equal(await page.evaluate(() => __mockData.market.players.Alpha_Alice.marketValue), original.value);
      assert.equal(await page.evaluate(() => JSON.stringify(__mockData.jet)), original.jet);
      assert.equal(await page.evaluate(() => JSON.stringify(__mockData.market.fantasy)), original.fantasy);
      assert.equal(await page.evaluate(() => history.length), length);
      assert.match(await page.locator('.career-table').innerText(), /Internacional FC/);
      assert.equal(await page.locator('.career-table [data-premium-club="Internacional FC"]').count(), 0);
      assert.match(await page.locator('.contract-summary').innerText(), /C.4/);
      await page.evaluate(() => __mockAuthChange(null));
      await page.waitForFunction(() => !document.getElementById('editAgentProfile'));
      await page.evaluate(() => ProfileEditor.openAgent('Alpha_Alice'));
      assert.equal(await page.locator('#profileEditorDialog').evaluate(el => el.open), false);
    }, { admin: true, expectedWrites: 1 });

    await scenario('Perfis: cancelamento e conflito preservam rascunho e histórico salvo', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.locator('#editAgentProfile').click();
      await page.locator('[data-field="name"]').fill('Alice revisada');
      await page.locator('#peReviewBtn').click();
      await page.evaluate(() => { __mockData.market.players.Alpha_Alice.name = 'Nome salvo por outro admin'; __mockEmit(); });
      await page.locator('#peSaveBtn').click();
      await page.waitForFunction(() => document.getElementById('peStatus').textContent.includes('outra sessão'));
      assert.equal(await page.locator('#profileEditorDialog').evaluate(el => el.open), true);
      await page.locator('#peBack').click();
      assert.equal(await page.locator('[data-field="name"]').inputValue(), 'Alice revisada');
      assert.equal(await page.evaluate(() => __mockData.market.players.Alpha_Alice.name), 'Nome salvo por outro admin');
      assert.equal(await page.evaluate(() => __writes.length), 0);
      await screenshot(page, 'agent-profile-editor');
      await noOverflow(page);
    }, { admin: true }, {width:390,height:844});

    await scenario('Perfis: passagem antiga é editada e excluída sem alterar vínculo, Fantasy ou transferências', async page => {
      await ready(page, '?player=Alpha_Alice');
      await page.evaluate(() => {
        __mockData.market.players.Alpha_Alice.careerHistory={old:{teamKind:'external',teamName:'Clube Internacional',fromCycle:'C.1',toCycle:'C.2',fromDate:'',toDate:'',binding:'',notes:'',source:'manual',playerId:'legacy:Alpha_Alice',extra:'preservar'}};
        __mockEmit();
      });
      await page.waitForFunction(()=>document.querySelector('.career-table')?.textContent.includes('Clube Internacional'));
      const original=await page.evaluate(()=>({jet:JSON.stringify(__mockData.jet),fantasy:JSON.stringify(__mockData.market.fantasy),transfers:JSON.stringify(__mockData.market.transfers)}));
      await page.locator('#editAgentProfile').click(); await page.locator('[data-tab="career"]').click();
      await page.locator('[data-history-field="toCycle"]').fill('C.3');
      await page.locator('#peReviewBtn').click(); await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.equal(await page.evaluate(()=>__mockData.market.players.Alpha_Alice.careerHistory.old.extra),'preservar');
      assert.match(await page.locator('.career-table').innerText(),/C.3/);
      await page.locator('#editAgentProfile').click(); await page.locator('[data-tab="career"]').click();
      page.removeAllListeners('dialog'); page.on('dialog',d=>d.accept());
      await page.locator('[data-action="remove-history"]').click();
      assert.equal(await page.evaluate(()=>Object.keys(__mockData.market.players.Alpha_Alice.careerHistory).length),1,'exclusão ainda é rascunho');
      await page.locator('#peReviewBtn').click(); await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.equal(await page.evaluate(()=>Object.keys(__mockData.market.players.Alpha_Alice.careerHistory || {}).length),0);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.jet)),original.jet);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.market.fantasy)),original.fantasy);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.market.transfers)),original.transfers);
      assert.equal(await page.evaluate(()=>__mockData.market.players.Alpha_Alice.status),'ativo');
    }, {admin:true,expectedWrites:2});

    await scenario('Perfis: saída internacional exige ação própria e sincronização Jet separada', async page => {
      await ready(page,'?player=Alpha_Alice');
      const fantasy=await page.evaluate(()=>JSON.stringify(__mockData.market.fantasy));
      await page.locator('#editAgentProfile').click(); await page.locator('[data-tab="exit"]').click();
      await page.locator('#peExitTeam').fill('Equipe Internacional');
      await page.locator('[data-action="review-exit"]').click();
      assert.match(await page.locator('#peReview').innerText(),/somente no Market/);
      assert.equal(await page.evaluate(()=>__writes.length),0);
      await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.equal(await page.evaluate(()=>__mockData.market.players.Alpha_Alice.team),'Equipe Internacional');
      assert.equal(await page.evaluate(()=>__mockData.market.players.Alpha_Alice.marketValue),20000000);
      assert.equal(await page.evaluate(()=>__mockData.jet.liga.rosters.Alpha.some(p=>p.n==='Alice')),true);
      assert.equal(await page.evaluate(()=>__writes.length),1);
      page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
      await page.getByRole('button',{name:'Sincronizar saída na Jet League (opcional)',exact:true}).click();
      await page.waitForFunction(()=>!__mockData.jet.liga.rosters.Alpha.some(p=>p.n==='Alice'));
      assert.equal(await page.evaluate(()=>__mockData.jet.liga.rosters['Equipe Internacional']),undefined);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.market.fantasy)),fantasy);
      assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w.group)),['market','jet']);
    },{admin:true,expectedWrites:2});

    await scenario('Perfis: editor institucional salva títulos e história mantendo elenco real da liga', async page => {
      await ready(page,'?club=Alpha');
      const original=await page.evaluate(()=>({jet:JSON.stringify(__mockData.jet),players:JSON.stringify(__mockData.market.players),fantasy:JSON.stringify(__mockData.market.fantasy)}));
      await page.locator('#editClubProfile').click();
      await page.locator('[data-field="description"]').fill('História cadastrada pelo mestre.');
      await page.locator('[data-field="founded"]').fill('C.1');
      await page.evaluate(()=>__mockEmit());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.locator('[data-field="founded"]').inputValue(),'C.1');
      await page.locator('[data-tab="achievements"]').click();
      await page.locator('[data-field="title_nacional"]').fill('2');
      await page.locator('[data-action="add-club-row"][data-group="placements"]').click();
      await page.locator('[data-record-field="competition"]').fill('Nacional');
      await page.locator('[data-record-field="cycle"]').fill('C.2');
      await page.locator('[data-record-field="place"]').fill('Campeão');
      await page.locator('[data-tab="memory"]').click();
      await page.locator('[data-field="bestEra"]').fill('C.2 — campanha informada manualmente');
      await page.locator('[data-field="rivalries"]').fill('Beta');
      await page.locator('[data-field="legends"]').fill('Ídolo histórico cadastrado');
      await page.locator('[data-action="add-club-row"][data-group="formerMembers"]').click();
      await page.locator('[data-record-field="name"]').fill('Ex-integrante externo');
      await page.locator('[data-record-field="fromCycle"]').fill('C.1');
      await page.locator('[data-record-field="toCycle"]').fill('C.2');
      await screenshot(page,'club-profile-editor');
      await page.locator('#peReviewBtn').click();
      assert.equal(await page.evaluate(()=>__writes.length),0);
      await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.match(await page.locator('.club-institution').innerText(),/Ex-integrante externo/);
      assert.match(await page.locator('.club-institution').innerText(),/Campeão/);
      assert.equal(await page.evaluate(()=>ProfileData.clubProfile('Alpha').titles.nacional),2);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.jet)),original.jet);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.market.players)),original.players);
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData.market.fantasy)),original.fantasy);
      assert.equal(await page.evaluate(()=>__writes[0].path),'settings/clubProfiles/'+await page.evaluate(()=>ProfileData.clubKey('Alpha')));
      await noOverflow(page);await screenshot(page,'club-profile');
    },{admin:true,expectedWrites:1},{width:390,height:844});

    await scenario('Glória: cria, associa, edita e exclui conquista sem recalcular títulos ou afetar outros domínios', async page => {
      await ready(page,'?player=Alpha_Alice');
      await page.evaluate(()=>{__mockData.market.players.Alpha_Alice.titles={nacional:2};__mockData.market.players.Alpha_Alice.trophy=2;__mockEmit();});
      await page.waitForFunction(()=>document.querySelector('.title-card.nacional .title-count')?.textContent==='2');
      const original=await page.evaluate(()=>({jet:JSON.stringify(__mockData.jet),fantasy:JSON.stringify(__mockData.market.fantasy),transfers:JSON.stringify(__mockData.market.transfers),value:__mockData.market.players.Alpha_Alice.marketValue,history:history.length}));
      await page.locator('#manageAchievements').click();
      await page.locator('[data-action="add-club-row"][data-group="achievements"]').click();
      await page.locator('[data-record-field="type"]').selectOption('nacional');
      await page.locator('[data-record-field="competitionName"]').fill('Nacional histórico');
      await page.locator('[data-record-field="result"]').fill('Campeão');
      await page.locator('[data-record-field="teamKind"]').selectOption('league');
      await page.locator('[data-record-field="teamName"]').fill('Beta');
      await page.locator('[data-record-field="season"]').fill('C.1');
      await page.locator('[data-record-field="legacySlot"]').fill('1');
      await page.evaluate(()=>__mockEmit());
      assert.equal(await page.locator('[data-record-field="season"]').inputValue(),'C.1');
      await screenshot(page,'glory-editor');
      await page.locator('#peReviewBtn').click();
      assert.equal(await page.evaluate(()=>__writes.length),0);
      assert.match(await page.locator('#peReview').innerText(),/título antigo #1/);
      await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.match(await page.locator('.agent-glory').innerText(),/1 de 2/);
      assert.equal(await page.evaluate(()=>history.length),original.history,'salvar não cria navegação');
      assert.match(await page.locator('.agent-glory').innerText(),/informação não registrada/);
      await noOverflow(page); await screenshot(page,'glory-profile');
      await page.locator('.agent-glory [data-premium-club="Beta"]').click();
      await page.waitForFunction(()=>AppState.ui.selectedClub==='Beta');
      assert.match(await page.locator('.club-agent-glory').innerText(),/Nacional histórico/);
      assert.equal(await page.evaluate(()=>ProfileData.clubProfile('Beta').titles),undefined);
      await page.goBack(); await page.waitForSelector('#manageAchievements');
      original.history=await page.evaluate(()=>history.length);
      await page.locator('#manageAchievements').click();
      await page.locator('[data-record-field="season"]').fill('C.2');
      await page.locator('#peReviewBtn').click();await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.match(await page.locator('.agent-glory .glory-card').innerText(),/C.2/);
      await page.locator('#manageAchievements').click();
      page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());
      await page.locator('[data-action="remove-club-row"]').click();
      assert.equal(await page.evaluate(()=>Object.keys(__mockData.market.players.Alpha_Alice.achievements).length),1);
      await page.locator('#peReviewBtn').click();await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.equal(await page.locator('.agent-glory .glory-card').count(),0);
      const result=await page.evaluate(()=>({jet:JSON.stringify(__mockData.jet),fantasy:JSON.stringify(__mockData.market.fantasy),transfers:JSON.stringify(__mockData.market.transfers),value:__mockData.market.players.Alpha_Alice.marketValue,history:history.length,titles:__mockData.market.players.Alpha_Alice.titles,trophy:__mockData.market.players.Alpha_Alice.trophy}));
      assert.deepEqual(result,{...original,titles:{nacional:2},trophy:2});
      assert.equal(await page.evaluate(()=>__writes.every(write=>write.group==='market' && write.path==='players/Alpha_Alice')),true);
    },{admin:true,expectedWrites:3},{width:390,height:844});

    await scenario('Glória: campeonato explícito, prêmio internacional, cancelamento e proteção de conflito', async page => {
      await ready(page,'?player=Alpha_Alice');
      await page.evaluate(()=>{AppState.jet.hallOfFame={official:{type:'mundial',competitionName:'Mundial registrado',season:'C.3',result:'Campeão',teamName:'Organização Internacional'}};});
      await page.locator('#manageAchievements').click();
      await page.locator('[data-action="add-club-row"][data-group="achievements"]').click();
      await page.locator('[data-record-field="officialId"]').selectOption('official');
      assert.equal(await page.locator('[data-record-field="teamName"]').inputValue(),'Organização Internacional');
      await page.locator('#peReviewBtn').click(); await page.locator('#peSaveBtn').click();
      await page.waitForFunction(()=>!document.getElementById('profileEditorDialog').open);
      assert.match(await page.locator('.agent-glory').innerText(),/Campeonato vinculado: official/);
      assert.equal(await page.locator('.agent-glory [data-premium-club]').count(),0);
      assert.equal(await page.evaluate(()=>__mockData.market.players.Alpha_Alice.titles),undefined);
      await page.locator('#manageAchievements').click();
      await page.locator('[data-record-field="officialId"]').selectOption('');
      await page.locator('[data-record-field="type"]').selectOption('individual');
      await page.locator('[data-record-field="result"]').fill('MVP');
      await page.locator('#peReviewBtn').click();
      await page.evaluate(()=>{Object.values(__mockData.market.players.Alpha_Alice.achievements)[0].notes='Outra sessão';__mockEmit();});
      await page.locator('#peSaveBtn').click();await page.waitForFunction(()=>document.getElementById('peStatus').dataset.error==='true');
      await page.locator('#peBack').click();
      assert.equal(await page.locator('[data-record-field="result"]').inputValue(),'MVP');
      page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());
      await page.locator('.pe-close').click();
      assert.equal(await page.evaluate(()=>Object.values(__mockData.market.players.Alpha_Alice.achievements)[0].result),'Campeão');
      await page.evaluate(()=>__mockAuthChange(null));
      await page.waitForFunction(()=>!document.getElementById('manageAchievements'));
      assert.equal(await page.locator('#editAgentProfile').count(),0);
    },{admin:true,expectedWrites:1});

    await scenario('Legado: galeria, trajetória, ídolos e antigos integrantes responsivos sem alterar dados', async page => {
      await ready(page,'?club=KOF%2012');
      const original=await page.evaluate(()=>JSON.stringify(__mockData));
      assert.equal(await page.locator('.legacy-brand h1').innerText(),'KOF 12');
      assert.equal(await page.locator('#editClubProfile').count(),1);
      assert.equal(await page.locator('.legacy-trophy.is-winner strong').innerText(),'2');
      assert.match(await page.locator('.legacy-trophy.is-winner').innerText(),/Temporada 2 · Temporada 3/);
      assert.doesNotMatch(await page.locator('.legacy-trophy.is-winner').innerText(),/Temporada 1/);
      assert.deepEqual(await page.locator('.legacy-cycle').allTextContents(),['Temporada 1','Temporada 2','Temporada 3']);
      assert.equal(await page.locator('.legacy-campaign.podium-gold').count(),2);
      assert.equal(await page.locator('.legacy-people.legends [data-premium-player]').count(),2);
      assert.match(await page.locator('.legacy-former').innerText(),/Ex-integrante internacional/);
      assert.match(await page.locator('.legacy-former').innerText(),/Empréstimo/);
      for(const [width,label] of [[1440,'desktop'],[1180,'notebook'],[820,'tablet'],[390,'mobile']]) {
        await page.setViewportSize({width,height:1000});
        await page.evaluate(()=>window.scrollTo(0,0));
        await noOverflow(page);
        assert.ok(await page.locator('.legacy-brand h1').evaluate(el=>el.getBoundingClientRect().height)<90,'nome da equipe permanece legível');
        assert.equal(await page.locator('.legacy-panel').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),true);
        await screenshot(page,'legacy-'+label);
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.ok(await page.locator('.legacy-person').first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))<=0.001);
      await page.locator('[data-legacy-order]').selectOption('desc');
      assert.deepEqual(await page.locator('.legacy-cycle').allTextContents(),['Temporada 3','Temporada 2','Temporada 1']);
      await page.locator('.legacy-people.legends [data-premium-player="KOF 12_Jenny"]').click();
      await page.waitForSelector('#editAgentProfile');
      await page.goBack(); await page.waitForSelector('.legacy-hero');
      assert.equal(await page.locator('[data-legacy-order]').inputValue(),'desc');
      await page.goForward(); await page.waitForSelector('#editAgentProfile');
      await page.goBack(); await page.waitForSelector('.legacy-hero');
      assert.equal(await page.evaluate(()=>JSON.stringify(__mockData)),original);
      await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
      await screenshot(page,'legacy-light');
    },{admin:true,rosters:{'KOF 12':[{n:'Jenny'},{n:'Jun'},{n:'Malenia Bianchi'}]},players:{'KOF 12_Jenny':{name:'Jenny',marketValue:10000000},'KOF 12_Jun':{name:'Jun',marketValue:8000000},'KOF 12_Malenia Bianchi':{name:'Malenia Bianchi',marketValue:9000000}},settings:{clubProfiles:{'club_4b-4f-46-20-31-32':legacyFixture()}}},{width:1440,height:1000});

    await scenario('Legado: perfil sem história não reserva painéis e visitante não recebe edição', async page => {
      await ready(page,'?club=Alpha');
      assert.equal(await page.locator('#editClubProfile').count(),0);
      assert.equal(await page.locator('.legacy-panel').count(),0);
      assert.equal(await page.locator('.legacy-grid').evaluate(el=>el.getBoundingClientRect().height),0);
      assert.equal(await page.locator('.legacy-hero .legacy-shield').count(),1);
      assert.equal(await page.locator('.club-roster-section tbody tr').count(),31);
      await noOverflow(page);
    },{},{width:390,height:844});

    console.log(`${passed} cenários de navegador passaram. Rede externa bloqueada; escritas restritas ao mock.`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
