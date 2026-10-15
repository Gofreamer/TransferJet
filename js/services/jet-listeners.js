/* Jet League listeners — unificado em listeners.js
   Mantido só por compatibilidade se algum HTML antigo referenciar este arquivo.
   A implementação ativa é startJetListeners() em js/services/listeners.js
*/
(function () {
  if (typeof window.startJetListeners !== "function") {
    console.warn("[Jet Market] jet-listeners.js: use listeners.js (startJetListeners).");
  }
})();
