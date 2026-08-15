/* Jet Market — Firebase AI Logic (Gemini)
   Alinhado ao padrão do Jet League.
   Tenta Jet League (AI costuma já estar ativa) e, se falhar, o projeto Market.
*/

(function () {
  let cachedGenerate = null;
  let lastError = null;

  const MODEL_CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ];

  async function loadSDK() {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
    const { getAI, getGenerativeModel, GoogleAIBackend } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js");
    return { initializeApp, getApps, getAI, getGenerativeModel, GoogleAIBackend };
  }

  function getOrInitApp(initializeApp, getApps, config, name) {
    if (!config || !config.apiKey) throw new Error("Config Firebase ausente para " + name);
    const existing = (getApps && getApps()) || [];
    const found = existing.find(a => a.name === name);
    if (found) return found;
    return initializeApp(config, name);
  }

  async function tryGenerateWithConfig(sdk, config, appName, prompt, preferredModel) {
    const app = getOrInitApp(sdk.initializeApp, sdk.getApps, config, appName);
    const ai = sdk.getAI(app, { backend: new sdk.GoogleAIBackend() });

    const models = preferredModel
      ? [preferredModel, ...MODEL_CANDIDATES.filter(m => m !== preferredModel)]
      : MODEL_CANDIDATES;

    let lastErr = null;
    for (const modelName of models) {
      try {
        const model = sdk.getGenerativeModel(ai, { model: modelName });
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.() ?? result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && String(text).trim()) {
          console.log("[Jet Market] AI OK com modelo:", modelName, "app:", appName);
          return String(text).trim();
        }
        lastErr = new Error("Resposta vazia do modelo " + modelName);
      } catch (err) {
        lastErr = err;
        console.warn("[Jet Market] Modelo falhou:", modelName, appName, err?.message || err);
      }
    }
    throw lastErr || new Error("Nenhum modelo respondeu");
  }

  async function ensureGenerate() {
    if (cachedGenerate) return cachedGenerate;

    const sdk = await loadSDK();

    cachedGenerate = async (prompt, modelName = "gemini-3.6-flash") => {
      const attempts = [];

      // 1) Jet League (mesmo padrão do site principal)
      if (window.JET_FIREBASE_CONFIG) {
        try {
          return await tryGenerateWithConfig(
            sdk,
            window.JET_FIREBASE_CONFIG,
            "jetMarketAI_jet",
            prompt,
            modelName
          );
        } catch (err) {
          attempts.push("JetLeague: " + (err?.message || err));
          lastError = err;
        }
      }

      // 2) Projeto Market
      if (window.MARKET_FIREBASE_CONFIG) {
        try {
          return await tryGenerateWithConfig(
            sdk,
            window.MARKET_FIREBASE_CONFIG,
            "jetMarketAI_market",
            prompt,
            modelName
          );
        } catch (err) {
          attempts.push("Market: " + (err?.message || err));
          lastError = err;
        }
      }

      const detail = attempts.join(" | ") || (lastError && lastError.message) || "desconhecido";
      throw new Error("IA indisponível. " + detail);
    };

    return cachedGenerate;
  }

  window.marketGenerateWithAI = async (prompt, modelName = "gemini-3.6-flash") => {
    if (!prompt || !String(prompt).trim()) {
      throw new Error("Prompt vazio");
    }
    const fn = await ensureGenerate();
    return fn(String(prompt).trim(), modelName || "gemini-3.6-flash");
  };

  window.isAIReady = () => !!cachedGenerate;
  window.getLastAIError = () => lastError;
})();

window.generateWithAI = window.marketGenerateWithAI;
