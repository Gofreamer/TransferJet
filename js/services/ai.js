/* Gemini opcional: carregamento único, requisições compartilhadas e falhas limitadas. */
(function () {
  const DEFAULT_MODEL = "gemini-3.6-flash";
  const FALLBACK_MODELS = [DEFAULT_MODEL, "gemini-3.5-flash"];

  async function loadSDK() {
    const [app, ai] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js")
    ]);
    return { ...app, ...ai };
  }

  function errorKind(error) {
    if (error?.code?.startsWith("market-ai/")) return error.code.slice(10);
    const detail = `${error?.code || ""} ${error?.status || ""} ${error?.message || ""}`;
    if (/429|quota|resource.exhausted|too.many.requests/i.test(detail)) return "quota";
    if (/401|403|permission|unauthori|api.key|app.check|not.enabled/i.test(detail)) return "permission";
    if (/404|not.found|unsupported.model|model.*not.*support/i.test(detail)) return "model";
    if (/blocked|safety|recitation|no.candidate/i.test(detail)) return "content";
    if (/timeout|timed.out|abort/i.test(detail)) return "timeout";
    return "unavailable";
  }

  function readableError(error) {
    const kind = errorKind(error);
    const messages = {
      quota: "Limite de uso da IA atingido. Aguarde um pouco antes de tentar novamente.",
      permission: "IA indisponível neste projeto. Verifique a configuração do Firebase AI Logic.",
      model: "Nenhum dos modelos configurados está disponível neste projeto.",
      content: "A IA não retornou conteúdo utilizável. Ajuste o pedido e tente novamente.",
      timeout: "A IA demorou para responder. Tente novamente mais tarde.",
      offline: "Sem conexão para consultar a IA. Os demais recursos continuam disponíveis.",
      unavailable: "Não foi possível consultar a IA. Tente novamente mais tarde.",
      prompt: "Informe um pedido para a IA."
    };
    return Object.assign(new Error(messages[kind] || messages.unavailable), { code: "market-ai/" + kind });
  }

  function createClient({ load = loadSDK, configs = () => [
    ["jetMarketAI_jet", window.JET_FIREBASE_CONFIG],
    ["jetMarketAI_market", window.MARKET_FIREBASE_CONFIG]
  ], now = () => Date.now() } = {}) {
    let sdkPromise = null;
    let ready = false;
    let lastError = null;
    let preferredProject = null;
    const models = new Map();
    const pending = new Map();
    const cooldowns = new Map();

    function ensureSDK() {
      if (!sdkPromise) sdkPromise = Promise.resolve().then(load).then(sdk => {
        ready = true;
        return sdk;
      }).catch(error => { sdkPromise = null; throw error; });
      return sdkPromise;
    }

    async function run(prompt, requested, controller) {
      if (window.navigator?.onLine === false) throw { code: "market-ai/offline" };
      const projects = configs().filter(([, config]) => config?.apiKey);
      if (!projects.length) throw { code: "market-ai/permission" };
      const sdk = await ensureSDK();
      const candidates = [...new Set([requested, ...FALLBACK_MODELS])];
      projects.sort((a,b) => Number(b[0] === preferredProject) - Number(a[0] === preferredProject));
      let failure = { code: "market-ai/unavailable" };
      for (const [name, config] of projects) {
        const projectBlock = cooldowns.get(name);
        if (projectBlock?.until > now()) { failure = projectBlock.error; continue; }
        for (const modelName of candidates) {
          if (controller.signal.aborted) throw { code: "market-ai/timeout" };
          const key = name + "/" + modelName;
          const modelBlock = cooldowns.get(key);
          if (modelBlock?.until > now()) { failure = modelBlock.error; continue; }
          try {
            if (!models.has(key)) {
              const app = sdk.getApps().find(app => app.name === name) || sdk.initializeApp(config, name);
              const ai = sdk.getAI(app, { backend: new sdk.GoogleAIBackend() });
              models.set(key, sdk.getGenerativeModel(ai, { model: modelName }));
            }
            const result = await models.get(key).generateContent(prompt, { signal: controller.signal });
            if (controller.signal.aborted) throw { code: "market-ai/timeout" };
            const response = result?.response;
            const text = typeof response?.text === "function" ? response.text() : response?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
            if (!String(text || "").trim()) throw { code: "market-ai/content" };
            preferredProject = name;
            return String(text).trim();
          } catch (error) {
            failure = error;
            const kind = errorKind(error);
            if (controller.signal.aborted || kind === "timeout" || kind === "content") throw error;
            // Outro modelo só resolve indisponibilidade do modelo; não resolve quota/permissão.
            if (kind === "model") cooldowns.set(key, { until: now() + 300000, error });
            else { cooldowns.set(name, { until: now() + 30000, error }); break; }
          }
        }
      }
      throw failure;
    }

    function generate(prompt, modelName = DEFAULT_MODEL, options = {}) {
      prompt = String(prompt || "").trim();
      if (!prompt) return Promise.reject(readableError({ code: "market-ai/prompt" }));
      modelName = modelName || DEFAULT_MODEL;
      const requestedTimeout = Number(options.timeoutMs);
      const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? Math.min(60000, requestedTimeout) : 25000;
      const key = JSON.stringify([prompt, modelName, timeoutMs]);
      if (pending.has(key)) return pending.get(key);
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject({ code: "market-ai/timeout" }); }, timeoutMs);
      });
      const request = Promise.race([run(prompt, modelName, controller), deadline]).then(text => {
        lastError = null;
        return text;
      }).catch(error => {
        lastError = readableError(error);
        throw lastError;
      }).finally(() => { clearTimeout(timer); pending.delete(key); });
      pending.set(key, request);
      return request;
    }
    return { generate, isReady: () => ready, getLastError: () => lastError };
  }

  const client = createClient();
  window.MarketAI = { createClient, defaultModel: DEFAULT_MODEL };
  window.marketGenerateWithAI = client.generate;
  window.generateWithAI = client.generate;
  window.isAIReady = client.isReady;
  window.getLastAIError = client.getLastError;
})();
