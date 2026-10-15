const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const firebaseMock = require('./firebase-mock.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw Error('invalid path');
      const content = await fs.readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
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
      assert.equal(await page.locator('#clubProfileContent h1').innerText(), '<img src=x onerror="window.__xss=1">');
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

    console.log(`${passed} cenários de navegador passaram. Rede externa bloqueada; escritas restritas ao mock.`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
