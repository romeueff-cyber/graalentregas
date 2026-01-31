import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DeliveryPoint {
  orderNumber: string;
  clientName: string;
  address: string;
  lat: number;
  lng: number;
  expectedDelivery: string | null;
  volumeLiters: number;
  equipmentDescription: string;
}

interface RouteConfig {
  driverCount?: number; // Optional - AI will suggest if not provided
  workStartTime: string;
  workEndTime: string;
  period: 'manha' | 'tarde_noite';
  vehicleCapacityLiters: number;
  baseServiceTimeMinutes: number;
}

interface DriverSuggestion {
  recommendedDriverCount: number;
  reasoning: string;
  driversNeeded: {
    driverIndex: number;
    estimatedStops: number;
    estimatedVolume: number;
    estimatedEndTime: string;
  }[];
}

interface OptimizedAssignment {
  driverIndex: number;
  orders: {
    orderNumber: string;
    sequence: number;
    estimatedArrival: string;
    estimatedServiceTime: number;
    volumeLiters: number;
  }[];
  totalVolume: number;
  estimatedEndTime: string;
}

interface AIResponse {
  driverSuggestion: DriverSuggestion;
  assignments: OptimizedAssignment[];
  warnings: string[];
  unassignedOrders: string[];
}

// Check if time is valid (:00 or :30, but not 00:00)
function isValidTimeWindow(time: string | null): boolean {
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  // Only :00 or :30 minutes, and not midnight (00:00)
  if (h === 0 && m === 0) return false;
  return m === 0 || m === 30;
}

// Extract volume from equipment description
function extractVolumeLiters(description: string): number {
  // Match patterns like "30L", "30 L", "30 litros", "barril 30", etc.
  const matches = description.match(/(\d+)\s*(?:L|litros?)/gi);
  if (!matches) {
    // Try to find just numbers that look like volumes (20, 30, 50)
    const volumeMatch = description.match(/\b(20|30|50)\b/);
    if (volumeMatch) return parseInt(volumeMatch[1]);
    return 30; // Default to 30L
  }
  
  // Sum all volumes found (for multiple barrels)
  let total = 0;
  for (const match of matches) {
    const num = parseInt(match.match(/\d+/)![0]);
    total += num;
  }
  return total || 30;
}

// Calculate service time based on volume
function calculateServiceTime(volumeLiters: number): number {
  if (volumeLiters <= 30) return 30; // 30 minutes for small deliveries
  if (volumeLiters <= 60) return 40; // 40 minutes for medium
  if (volumeLiters <= 100) return 50; // 50 minutes for large
  return 60; // 60 minutes for very large
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { deliveries, config, action } = await req.json() as {
      deliveries: DeliveryPoint[];
      config: RouteConfig;
      action: 'suggest_drivers' | 'optimize_full';
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Process deliveries - extract volumes and filter by valid time windows
    const processedDeliveries = deliveries.map(d => ({
      ...d,
      volumeLiters: d.volumeLiters || extractVolumeLiters(d.equipmentDescription || ''),
      hasValidTimeWindow: isValidTimeWindow(d.expectedDelivery),
      estimatedServiceTime: calculateServiceTime(d.volumeLiters || extractVolumeLiters(d.equipmentDescription || '')),
    }));

    // Calculate totals for AI context
    const totalVolume = processedDeliveries.reduce((sum, d) => sum + d.volumeLiters, 0);
    const totalServiceTime = processedDeliveries.reduce((sum, d) => sum + d.estimatedServiceTime, 0);
    const fixedTimeDeliveries = processedDeliveries.filter(d => d.hasValidTimeWindow);
    const flexibleDeliveries = processedDeliveries.filter(d => !d.hasValidTimeWindow);

    // Calculate work window duration in minutes
    const [startH, startM] = config.workStartTime.split(':').map(Number);
    const [endH, endM] = config.workEndTime.split(':').map(Number);
    const workMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    const systemPrompt = `Você é um especialista em otimização de rotas de entrega para uma distribuidora de bebidas (Graal Beer).

REGRAS DE NEGÓCIO:
1. Cada veículo tem capacidade máxima de ${config.vehicleCapacityLiters} litros
2. Horário de trabalho: ${config.workStartTime} a ${config.workEndTime} (${workMinutes} minutos)
3. Tempo de entrega varia com o volume: 30L=30min, 60L=40min, 100L+=60min
4. 00:00 significa horário flexível (pode ir a qualquer momento)
5. O período atual é: ${config.period === 'manha' ? 'Manhã (08:00-12:00)' : 'Tarde/Noite (13:00-18:00)'}

REGRAS IMPORTANTES SOBRE HORÁRIOS FIXOS:
- Horário fixo (ex: 10:00) significa LIMITE MÁXIMO - a entrega deve chegar ATÉ esse horário, não exatamente nele
- Entregas podem ser feitas ANTES do horário fixo, nunca depois
- Se duas entregas têm o mesmo horário limite (ex: ambas 10:00), o mesmo entregador PODE fazer as duas, desde que:
  a) Estejam geograficamente próximas (considere lat/lng)
  b) Haja tempo suficiente para completar ambas antes do limite
  c) A soma dos volumes caiba no veículo
- PRIORIZE proximidade geográfica ao agrupar entregas - entregas próximas devem ir para o mesmo entregador

DADOS ATUAIS:
- Total de entregas: ${processedDeliveries.length}
- Volume total: ${totalVolume}L
- Tempo de serviço total estimado: ${totalServiceTime} minutos
- Entregas com horário fixo: ${fixedTimeDeliveries.length}
- Entregas flexíveis: ${flexibleDeliveries.length}

CRITÉRIOS PARA NÚMERO DE ENTREGADORES:
- Mínimo = ceil(totalVolume / ${config.vehicleCapacityLiters})
- Considere tempo de trabalho disponível
- Agrupe por proximidade geográfica PRIMEIRO, depois verifique se os horários são viáveis
- Só adicione mais entregadores se for IMPOSSÍVEL um único fazer as entregas a tempo
- Sempre arredonde para cima se necessário`;

    const userPrompt = action === 'suggest_drivers' 
      ? `Analise estas entregas e sugira quantos entregadores serão necessários:

${JSON.stringify(processedDeliveries.map(d => ({
  pedido: d.orderNumber,
  cliente: d.clientName,
  lat: d.lat,
  lng: d.lng,
  horarioLimite: d.expectedDelivery ? `até ${d.expectedDelivery}` : 'flexível',
  volume: d.volumeLiters + 'L',
  tempoEstimado: d.estimatedServiceTime + 'min'
})), null, 2)}

LEMBRE-SE:
- Horário fixo = LIMITE MÁXIMO (pode entregar antes)
- Considere a DISTÂNCIA entre os pontos (lat/lng) - entregas próximas podem ser feitas pelo mesmo entregador
- Só sugira mais entregadores se for realmente necessário por volume ou tempo

Responda com a sugestão de quantidade de entregadores e a justificativa.`
      : `Distribua estas entregas entre ${config.driverCount || 2} entregadores, respeitando:
1. Capacidade máxima de ${config.vehicleCapacityLiters}L por veículo
2. Horário fixo = LIMITE MÁXIMO (entrega deve chegar ATÉ esse horário, pode ser antes)
3. PRIORIZE proximidade geográfica - entregas próximas devem ir para o mesmo entregador
4. Balanceie a carga de trabalho

Entregas:
${JSON.stringify(processedDeliveries.map(d => ({
  pedido: d.orderNumber,
  cliente: d.clientName,
  endereco: d.address,
  lat: d.lat,
  lng: d.lng,
  horarioLimite: d.expectedDelivery ? `até ${d.expectedDelivery}` : 'flexível',
  volume: d.volumeLiters + 'L',
  tempoEstimado: d.estimatedServiceTime + 'min'
})), null, 2)}

Distribua as entregas entre os entregadores, agrupando por proximidade geográfica.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "route_optimization_result",
          description: "Retorna o resultado da otimização de rotas",
          parameters: {
            type: "object",
            properties: {
              driverSuggestion: {
                type: "object",
                properties: {
                  recommendedDriverCount: { type: "number", description: "Número recomendado de entregadores" },
                  reasoning: { type: "string", description: "Justificativa para a recomendação" },
                  driversNeeded: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        driverIndex: { type: "number" },
                        estimatedStops: { type: "number" },
                        estimatedVolume: { type: "number" },
                        estimatedEndTime: { type: "string" }
                      },
                      required: ["driverIndex", "estimatedStops", "estimatedVolume", "estimatedEndTime"]
                    }
                  }
                },
                required: ["recommendedDriverCount", "reasoning", "driversNeeded"]
              },
              assignments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    driverIndex: { type: "number" },
                    orders: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          orderNumber: { type: "string" },
                          sequence: { type: "number" },
                          estimatedArrival: { type: "string" },
                          estimatedServiceTime: { type: "number" },
                          volumeLiters: { type: "number" }
                        },
                        required: ["orderNumber", "sequence", "estimatedArrival"]
                      }
                    },
                    totalVolume: { type: "number" },
                    estimatedEndTime: { type: "string" }
                  },
                  required: ["driverIndex", "orders", "totalVolume", "estimatedEndTime"]
                }
              },
              warnings: {
                type: "array",
                items: { type: "string" },
                description: "Avisos sobre problemas encontrados"
              },
              unassignedOrders: {
                type: "array",
                items: { type: "string" },
                description: "Números dos pedidos que não puderam ser atribuídos"
              }
            },
            required: ["driverSuggestion", "assignments", "warnings", "unassignedOrders"]
          }
        }
      }
    ];

    console.log('Calling AI for route optimization:', action);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "route_optimization_result" } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('AI response received');

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const optimizationResult: AIResponse = JSON.parse(toolCall.function.arguments);

    // Add processed delivery info to the response
    return new Response(JSON.stringify({
      ...optimizationResult,
      processedDeliveries: processedDeliveries.map(d => ({
        orderNumber: d.orderNumber,
        volumeLiters: d.volumeLiters,
        estimatedServiceTime: d.estimatedServiceTime,
        hasValidTimeWindow: d.hasValidTimeWindow,
      }))
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in optimize-routes-ai:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
