
# Plano: Layout Responsivo para Página de Rotas

## Problema Identificado

Atualmente a página de rotas (`/rotas`) tem um layout fixo de desktop onde a sidebar tem largura fixa de 320px (`w-80`). Em dispositivos móveis, isso faz com que a sidebar ocupe quase toda a tela, deixando o mapa praticamente invisível conforme mostrado na screenshot.

## Solução Proposta

Implementar um layout responsivo **mobile-first** que funcione bem em todas as telas:

### Estrutura de Layout

```text
┌─────────────────────────────────┐
│           DESKTOP               │
├─────────────────────────────────┤
│ ┌────────┐┌───────────────────┐ │
│ │Sidebar ││                   │ │
│ │ 320px  ││      MAPA         │ │
│ │(scroll)││   (flex-grow)     │ │
│ │        ││                   │ │
│ └────────┘└───────────────────┘ │
└─────────────────────────────────┘

┌───────────────┐
│    MOBILE     │
├───────────────┤
│ ┌───────────┐ │
│ │   MAPA    │ │
│ │  (fixo)   │ │
│ │  250px    │ │
│ └───────────┘ │
│ ┌───────────┐ │
│ │  Sidebar  │ │
│ │  (scroll) │ │
│ │ Abas para │ │
│ │ alternar  │ │
│ └───────────┘ │
└───────────────┘
```

### Mudanças no Layout

**Mobile (< 768px):**
- Layout vertical: mapa fixo no topo (250px) + conteúdo abaixo com scroll
- Usar Tabs para alternar entre "Configurar" e "Resultados" quando houver rotas geradas
- O painel de detalhes (RouteStopsList) abre como Sheet/Drawer de baixo para cima

**Desktop (>= 768px):**
- Manter layout horizontal atual
- Sidebar 320px à esquerda, mapa flexível à direita, painel de detalhes à direita quando selecionado

## Arquivos a Modificar

### 1. `src/pages/RoutesPage.tsx`

- Adicionar hook `useIsMobile()` para detectar dispositivo
- Reestruturar layout principal:
  - Mobile: `flex-col` com mapa no topo e sidebar embaixo
  - Desktop: `flex-row` (atual)
- Usar `Sheet` component para mostrar detalhes da rota em mobile
- Ajustar classes CSS com breakpoints Tailwind (`md:`, `lg:`)

### 2. `src/components/routes/RouteMapView.tsx`

- Aceitar prop `height` dinâmica para controlar altura em mobile
- Adicionar altura mínima responsiva

### 3. `src/components/routes/RouteResultSummary.tsx`

- Compactar layout para mobile (menor padding, fonte menor)
- Cards de rota mais compactos em mobile

## Detalhes Técnicos

```tsx
// Exemplo da nova estrutura em RoutesPage.tsx
const isMobile = useIsMobile();

// Mobile: vertical layout
// Desktop: horizontal layout
<div className={`flex-1 flex overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
  
  {/* Mapa - primeiro em mobile */}
  <div className={isMobile ? 'h-[250px] flex-shrink-0' : 'flex-1'}>
    <RouteMapView ... />
  </div>
  
  {/* Sidebar - depois em mobile */}
  <div className={isMobile ? 'flex-1 overflow-y-auto' : 'w-80 flex-shrink-0'}>
    <RouteConfigForm ... /> ou <RouteResultSummary ... />
  </div>
  
  {/* Detalhes - Sheet em mobile, painel em desktop */}
  {selectedRouteData && (
    isMobile ? (
      <Sheet>
        <RouteStopsList route={selectedRouteData} />
      </Sheet>
    ) : (
      <div className="w-96 border-l">
        <RouteStopsList route={selectedRouteData} />
      </div>
    )
  )}
</div>
```

## Benefícios

- O mapa fica sempre visível em todas as telas
- Experiência touch-friendly em mobile
- Detalhes da rota acessíveis via drawer sem ocupar espaço do mapa
- Layout mais intuitivo seguindo padrões mobile do resto do app
