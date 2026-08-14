/* Jet Transfer — Firebase Config
   Dois apps: um para o próprio Transfermarkt e outro (somente leitura) para o Jet League
*/

// ============================================
// 1. TRANSFERMARKT (projeto novo - leitura + escrita)
// ============================================
window.TRANSFER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTVtEMJMTbtmAUmsCgscVRK5wBaHiUCI8",
  authDomain: "transfermarkt-545f7.firebaseapp.com",
  databaseURL: "https://transfermarkt-545f7-default-rtdb.firebaseio.com",
  projectId: "transfermarkt-545f7",
  storageBucket: "transfermarkt-545f7.firebasestorage.app",
  messagingSenderId: "790295110598",
  appId: "1:790295110598:web:c710ac54c6b6899de208c7"
};

// ============================================
// 2. JET LEAGUE (projeto existente - SOMENTE LEITURA)
// ============================================
window.JET_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCmchEqtsLaDdX4xQymX-BYDohEbsWSoog",
  authDomain: "teste-jet.firebaseapp.com",
  databaseURL: "https://teste-jet-default-rtdb.firebaseio.com",
  projectId: "teste-jet",
  storageBucket: "teste-jet.firebasestorage.app",
  messagingSenderId: "1062323455746",
  appId: "1:1062323455746:web:46f43585d2cd50df8ee41b"
};
