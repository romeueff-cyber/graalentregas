
# Plano: Corrigir Loop Infinito na Análise de IA

## Problema Identificado

O menu "Gerar Rotas" está preso em um loop infinito mostrando "Analisando entregas com IA..." porque:

1. O `useEffect` que dispara a análise de IA não verifica se já existe uma `suggestion` válida
2. Quando a análise termina (`isAnalyzing` muda de `true` para `false`), o effect é re-executado
3. Como `suggestion` não está nas condições de parada, uma nova análise é iniciada imediatamente
4. Este ciclo se repete indefinidamente (os logs mostram chamadas a cada ~5 segundos)

## Solução

### 1. Adicionar `suggestion` como condição de parada no useEffect

**Arquivo:** `src/pages/RoutesPage.tsx`

Alterar a lógica do useEffect (linhas 138-153) para verificar se já existe uma sugestão:

```typescript
// ANTES (com bug):
useEffect(() => {
  if (deliveryPoints.length === 0 || result || isAnalyzing) return;
  // ... análise é chamada mesmo se suggestion já existe
}, [deliveryPoints.length, currentPeriod, result, isAnalyzing, analyzeDeliveries]);

// DEPOIS (corrigido):
useEffect(() => {
  // Adicionar verificação de suggestion existente
  if (deliveryPoints.length === 0 || result || isAnalyzing || suggestion) return;
  
  const timeoutId = setTimeout(() => {
    analyzeDeliveries(deliveryPoints, {
      workStartTime: currentPeriod === 'manha' ? '08:00' : '13:00',
      workEndTime: currentPeriod === 'manha' ? '12:00' : '18:00',
      period: currentPeriod,
      serviceTimeMinutes: 30,
      vehicleCapacityLiters: 400,
    });
  }, 500);

  return () => clearTimeout(timeoutId);
// Adicionar suggestion às dependências
}, [deliveryPoints.length, currentPeriod, result, isAnalyzing, suggestion, analyzeDeliveries]);
```

### 2. Usar ref para controle de chamada única (proteção adicional)

Para garantir que a análise só seja chamada uma vez por sessão de dados, adicionar um `useRef`:

```typescript
const hasAnalyzedRef = useRef(false);

// Reset quando a data ou período muda
useEffect(() => {
  hasAnalyzedRef.current = false;
}, [selectedDateString, currentPeriod]);

useEffect(() => {
  if (deliveryPoints.length === 0 || result || isAnalyzing || suggestion) return;
  if (hasAnalyzedRef.current) return; // Proteção extra
  
  hasAnalyzedRef.current = true;
  
  const timeoutId = setTimeout(() => {
    analyzeDeliveries(deliveryPoints, {...});
  }, 500);

  return () => clearTimeout(timeoutId);
}, [deliveryPoints.length, currentPeriod, result, isAnalyzing, suggestion, analyzeDeliveries]);
```

### 3. Limpar suggestion quando a data muda

A função `handleDateChange` já chama `clearSuggestion()`, então a sugestão será limpa e uma nova análise será disparada quando o usuário mudar a data.

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RoutesPage.tsx` | Adicionar `suggestion` à condição de parada do useEffect e às dependências; Adicionar `useRef` para controle de chamada única |

## Benefícios

- Interrompe o loop infinito de chamadas à IA
- A análise só é feita uma vez por combinação de data/período
- Mudar a data ou período reinicia o ciclo corretamente
- Sem impacto na experiência do usuário - a sugestão continua aparecendo normalmente

## Detalhes Técnicos

A raiz do problema está na forma como React hooks funcionam:
- Quando `isAnalyzing` muda de `true` → `false`, o effect é re-avaliado
- Se `suggestion` não está na condição de guarda, o código dentro do effect executa novamente
- A nova chamada a `analyzeDeliveries` seta `isAnalyzing = true`, criando o ciclo

O fix é simples: se já temos uma `suggestion`, não precisamos analisar novamente.
