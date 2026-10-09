// Análise por IA: junta os dados da obra (prazo, progresso, gastos, etapas atrasadas)
// e pede pro Gemini escrever um resumo curto.
const express = require("express");
const { query } = require("../db");
const { mapRow, mapRows } = require("../utils/caseConvert");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

// A chave fica só aqui no backend e nunca vai pro navegador. O front chama
// /ai/analyze-obra e recebe o texto pronto.
// O modelo vem do GEMINI_MODEL porque o Google desliga modelos antigos de tempos
// em tempos; assim dá pra trocar no Railway sem mexer no código.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const GEMINI_TIMEOUT_MS = 20_000;

router.post("/analyze-obra", asyncHandler(async (req, res) => {
  const { obraId } = req.body || {};
  if (!obraId) return res.status(400).json({ message: "obraId é obrigatório." });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      message: "Análise por IA não configurada: defina GEMINI_API_KEY nas variáveis de ambiente do backend.",
    });
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const { rows: obraRows } = await query("SELECT * FROM obras WHERE id = $1", [obraId]);
  const obra = mapRow(obraRows[0]);
  if (!obra) return res.status(404).json({ message: "Obra não encontrada." });

  const { rows: stageRows } = await query(
    "SELECT * FROM etapas WHERE obra_id = $1 ORDER BY planned_start",
    [obraId]
  );
  const etapas = mapRows(stageRows);

  const { rows: gastoRows } = await query(
    "SELECT * FROM despesas_obra WHERE obra_id = $1",
    [obraId]
  );
  const gastos = mapRows(gastoRows);
  const totalGasto = gastos.reduce((sum, g) => sum + Number(g.value || 0), 0);

  const etapasAtrasadas = etapas.filter((e) => e.status === "Atrasada");

  // quanto do tempo do cronograma já passou (de hoje entre o início e o término previsto), de 0 a 100
  let percentTempo = null;
  if (obra.startDate && obra.endDate) {
    const hoje = new Date();
    const inicio = new Date(obra.startDate);
    const fim = new Date(obra.endDate);
    if (fim > inicio) {
      percentTempo = Math.min(100, Math.max(0, Math.round(((hoje - inicio) / (fim - inicio)) * 100)));
    }
  }

  // o prompt leva só números e nomes da obra e pede um texto curto, direto e sem markdown
  const prompt = `Você é um assistente de gestão de obras. Analise os dados abaixo de uma obra de construção civil e escreva um resumo curto (máximo 4 frases, em português do Brasil), destacando: situação geral de prazo, situação financeira, e um ponto de atenção prático se houver. Seja direto e objetivo, sem saudações e sem introduções como "aqui está a análise". Não use markdown nem listas, apenas texto corrido.

Nome da obra: ${obra.name}
Tipo: ${obra.tipo || "não informado"}
Status: ${obra.status}
Progresso registrado: ${obra.progress}%
Tempo decorrido do cronograma: ${percentTempo != null ? percentTempo + "%" : "não calculável"}
Data de início: ${obra.startDate || "não informada"}
Data prevista de término: ${obra.endDate || "não informada"}
Orçamento estimado: ${obra.estimatedCost != null ? "R$ " + obra.estimatedCost : "não informado"}
Total gasto até agora: R$ ${totalGasto.toFixed(2)}
Etapas cadastradas: ${etapas.length}
Etapas atrasadas: ${etapasAtrasadas.length}${etapasAtrasadas.length ? " (" + etapasAtrasadas.map((e) => e.name).join(", ") + ")" : ""}`;

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // chave no cabeçalho (e não na URL) pra não aparecer nos logs
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // folga de tokens: os modelos mais novos gastam parte do limite "pensando" antes
          // de responder, e um limite baixo cortaria o texto
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );
  } catch (err) {
    console.error("[ai] Falha ao chamar o Gemini:", err.name, err.message);
    return res.status(502).json({ message: "Não foi possível gerar a análise agora. Tente novamente em instantes." });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "");
    console.error("[ai] Erro na API do Gemini:", geminiRes.status, model, errText);
    const message = geminiRes.status === 429
      ? "Limite de uso da IA atingido por agora. Tente novamente em alguns minutos."
      : "Não foi possível gerar a análise agora. Tente novamente em instantes.";
    return res.status(502).json({ message });
  }

  const data = await geminiRes.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const analysis = parts.map((p) => p.text || "").join("").trim();

  if (!analysis) {
    return res.status(502).json({ message: "A IA não retornou uma análise válida." });
  }

  res.json({ analysis });
}));

module.exports = router;
