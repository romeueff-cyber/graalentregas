import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if ('error' in authResult) return authResult.error;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[ocr-patrimony] LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image } = await req.json();

    if (!image || typeof image !== 'string' || image.length > 8_000_000) {
      return new Response(
        JSON.stringify({ error: "Imagem inválida" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[ocr-patrimony] Processing image for OCR (user:", authResult.userId, ")");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em leitura de códigos de patrimônio de equipamentos.
Sua tarefa é extrair APENAS o código de patrimônio visível na imagem.
O código geralmente está escrito à mão ou impresso em etiquetas.
Retorne APENAS o código, sem explicações, pontuação extra ou formatação.
Se houver múltiplos códigos, separe-os por vírgula.
Se não conseguir identificar nenhum código, retorne "NENHUM_CODIGO_ENCONTRADO".
Exemplos de códigos válidos: CH001, CHOP-123, 12345, PAT-0001, etc.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia o código de patrimônio desta imagem:" },
              {
                type: "image_url",
                image_url: {
                  url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("[ocr-patrimony] AI gateway error:", status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content?.trim() || "";

    let codes: string[] = [];
    if (extractedText && extractedText !== "NENHUM_CODIGO_ENCONTRADO") {
      codes = extractedText
        .split(',')
        .map((code: string) => code.trim().toUpperCase())
        .filter((code: string) => code.length > 0 && code !== "NENHUM_CODIGO_ENCONTRADO");
    }

    return new Response(
      JSON.stringify({ success: true, codes, rawText: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[ocr-patrimony] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
