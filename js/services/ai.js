/* Jet Market — Firebase AI Logic (Gemini 3.6 Flash)
   Reutiliza o mesmo padrão do Jet League.
   Usa o projeto Jet League para AI (já configurado) ou Market se disponível.
*/

(function () {
  // Carrega o SDK modular apenas quando necessário
  let aiReady = false;
  let generateFn = null;

  async function ensureAI() {
    if (generateFn) return generateFn;

    try {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js");

      // Preferimos o projeto Jet League (já tem AI Logic ativo na maioria dos casos)
      const config = window.JET_FIREBASE_CONFIG || window.MARKET_FIREBASE_CONFIG;
      const aiApp = initializeApp(config, "jetMarketAI");
      const ai = getAI(aiApp, { backend: new GoogleAIBackend() });

      generateFn = async (prompt, modelName = "gemini-3.6-flash") => {
        const model = getGenerativeModel(ai, { model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      };

      aiReady = true;
      console.log("[Jet Market] AI Logic pronto (Gemini)");
      return generateFn;
    } catch (err) {
      console.warn("[Jet Market] AI Logic indisponível:", err);
      throw err;
    }
  }

  window.marketGenerateWithAI = async (prompt, modelName = "gemini-3.6-flash") => {
    const fn = await ensureAI();
    return fn(prompt, modelName);
  };

  window.isAIReady = () => aiReady;
})();
