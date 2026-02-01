
# Correção da Data de Recolha no Balão do Mapa

## Problema Identificado

A data de recolha do pedido 6999 está aparecendo como **30/01** no balão do mapa, quando deveria ser **31/01**.

**Causa raiz:** A função `formatShortDate` no componente `MarkerLabel.tsx` usa `new Date(dateStr)` para datas no formato "YYYY-MM-DD". O JavaScript interpreta isso como meia-noite UTC, e ao converter para o horário de São Paulo (UTC-3), a data "volta" um dia.

**Dados no banco:**
- `data_prevista_recolha`: `2026-01-31` (correto)
- Exibição atual: `30/01` (errado)

## Solução

Modificar a função `formatShortDate` no `MarkerLabel.tsx` para extrair os componentes da data localmente, evitando a conversão UTC.

### Alterações Técnicas

**Arquivo: `src/components/map/MarkerLabel.tsx`**

Substituir a função atual:
```typescript
function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '--/--';
  try {
    const date = new Date(dateStr);
    return format(date, 'dd/MM', { locale: ptBR });
  } catch {
    return '--/--';
  }
}
```

Por uma versão que respeita o timezone local:
```typescript
function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '--/--';
  try {
    // Para datas no formato YYYY-MM-DD, extrair componentes diretamente
    // para evitar problemas de timezone
    if (dateStr.length === 10 && dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    }
    
    // Para datas com timestamp, criar Date com horário ao meio-dia
    const date = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
    return format(date, 'dd/MM', { locale: ptBR });
  } catch {
    return '--/--';
  }
}
```

## Resultado Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| Recolha pedido 6999 | 30/01 | 31/01 |

## Impacto

- Corrige a exibição de todas as datas de recolha nos balões do mapa
- Não afeta outras funcionalidades (a lógica de cálculo de dias permanece intacta)
- Padrão consistente com o `lovable-stack-overflow` que recomenda usar componentes locais para datas de calendário
