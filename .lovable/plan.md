# Roadmap de Melhorias - Graal Entregas

## 🎯 Ideias Salvas

---

### 🔍 **Busca e Filtros Avançados**
- [ ] Busca global unificada (clientes, equipamentos, pedidos em um só lugar)
- [ ] Filtros salvos/favoritos para consultas frequentes
- [ ] Histórico de buscas recentes

### 📸 **Gestão de Mídia**
- [ ] Galeria de fotos por cliente/equipamento
- [ ] Comparativo visual antes/depois da higienização
- [ ] Captura de fotos com marca d'água automática (data/hora/localização)

### 📅 **Agenda e Calendário**
- [ ] Visualização em calendário das entregas e higienizações
- [ ] Agendamento drag-and-drop
- [ ] Sincronização com Google Calendar

### 🔔 **Central de Notificações**
- [ ] Painel de notificações in-app com histórico
- [ ] Configurações personalizadas por usuário (o que quer receber)
- [ ] Resumo diário automático por email

### 📱 **QR Code Avançado**
- [ ] QR Code único por equipamento para rastreamento
- [ ] Cliente escaneia para ver status em tempo real
- [ ] Check-in/check-out automático por QR

### 💬 **Feedback do Cliente**
- [ ] Avaliação de satisfação pós-serviço
- [ ] Comentários e sugestões dos clientes
- [ ] NPS (Net Promoter Score) automático

### 🌙 **Modo Escuro**
- [ ] Tema dark para uso noturno
- [ ] Alternância automática por horário

---

### 📊 **Analytics & Relatórios**
- [ ] Dashboards de gestão para performance de entregas
- [ ] Métricas de ciclos de higienização
- [ ] Exportação de relatórios PDF/Excel
- [ ] KPIs: tempo médio de recolha, entregas por dia, etc.

### ⚙️ **Operações**
- [ ] Otimização de rotas aprimorada para motoristas
- [ ] Captura de assinatura digital na entrega/recolha
- [ ] Controle de inventário/estoque de equipamentos
- [ ] Drag & Drop para realocar paradas entre rotas (mobile)

### 🤖 **Automação & IA**
- [ ] Assistente IA para motoristas (procedimentos e dúvidas)
- [ ] Consultas em linguagem natural para gestores
- [ ] Notificações automáticas WhatsApp/Push para alertas de manutenção
- [ ] Sugestão automática de número ideal de entregadores (IA)
- [ ] Rotina automática de status via cron job (ENTREGUE → LIBERADO)

### 🔐 **Segurança**
- [ ] Logs de auditoria de atividades (quem fez o quê)
- [ ] Controles de acesso baseados em permissões granulares

### 🛡️ **Estabilidade**
- [ ] Restauração de login offline com cache de sessão localforage
- [ ] Tratamento de ERP offline com fallback gracioso
- [ ] Melhorias no cache offline de pedidos do ERP

### 🗺️ **Melhorias no Mapa**
- [ ] Cluster de marcadores quando há muitos pontos próximos
- [ ] Filtro por entregador no mapa
- [ ] Visualização de rotas otimizadas no mapa principal

### 💰 **Financeiro**
- [ ] Dashboard financeiro com gráficos
- [ ] Relatório de inadimplência
- [ ] Alertas de boletos próximos ao vencimento

### 📲 **PWA & Mobile**
- [ ] Push notifications nativas
- [ ] Modo offline mais robusto
- [ ] Geofencing para check-in automático

---

## ✅ Implementado

- [x] Correção da data de recolha no balão do mapa (timezone)
- [x] Auto-transição de status ENTREGUE → LIBERADO_PARA_RECOLHA ao carregar equipamentos
- [x] Tokens únicos para confirmação de cliente (UUID + expiração)
- [x] Link WhatsApp para confirmação de recolha
- [x] Otimização de rotas com IA (Gemini)
- [x] Geocodificação paralela em lotes
- [x] Cache offline de pedidos ERP com TTL
- [x] Módulo de boletos com Cora Bank
- [x] Módulo de higienização completo
