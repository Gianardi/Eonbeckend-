// ============================================================
// EON — Endpoint AI sicuro
// ============================================================
// Questo file va nella cartella /api di un progetto Vercel.
// La chiave Claude vive SOLO qui sul server (variabile d'ambiente
// ANTHROPIC_API_KEY su Vercel), mai nel telefono del tester.
//
// L'app chiama questo endpoint (es. https://tuo-progetto.vercel.app/api/ai)
// invece di chiamare direttamente api.anthropic.com.
// ============================================================

import { verifyUser } from "./_verifyUser.js";

export default async function handler(req, res) {
  // Solo richieste POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  // Sicurezza: verifica che la richiesta arrivi da un utente vero e loggato.
  const user = await verifyUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Utente non autenticato" });
  }

  const { prompt, maxTokens } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Manca il campo 'prompt'" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens || 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Errore Anthropic:", response.status, errText);
      return res.status(502).json({ error: "L'AI non ha risposto correttamente" });
    }

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    return res.status(200).json({ text });
  } catch (err) {
    console.error("Errore chiamata AI:", err);
    return res.status(500).json({ error: "Errore interno del server" });
  }
}
