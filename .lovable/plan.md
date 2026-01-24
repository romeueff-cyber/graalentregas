

## Correção do Login Offline - "Nenhuma sessão salva encontrada"

### Diagnóstico do Problema

O login offline está falhando porque o cache de autenticação está sendo limpo incorretamente durante a inicialização do app. Existem três pontos problemáticos:

1. **Race condition no listener**: O `onAuthStateChange` limpa o cache quando `session` é `null`, mesmo em cenários offline onde o cache deveria ser preservado
2. **Estado não atualizado**: O login offline na AuthPage navega para home sem atualizar o contexto de autenticação (`user`, `session`, etc.)
3. **Limpeza prematura**: A lógica de cleanup pode remover dados válidos do cache

---

### Solução Proposta

#### 1. Proteger o cache durante modo offline

Modificar o `useAuth.tsx` para:
- Não limpar o cache quando estiver offline
- Verificar se está online antes de qualquer operação de `authStorage.clear()`
- Preservar dados cacheados quando a rede falhar

#### 2. Restaurar estado ao fazer login offline

Modificar a `AuthPage.tsx` para:
- Após validar o cache offline, **atualizar o contexto** com os dados cacheados
- Adicionar uma função no `useAuth` para restaurar sessão do cache

#### 3. Melhorar a lógica do listener de autenticação

No `onAuthStateChange`:
- Só limpar cache se estiver online E a sessão for explicitamente null
- Adicionar verificação `isOnline()` antes de qualquer `clear()`

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAuth.tsx` | Adicionar função `restoreFromCache`, proteger `authStorage.clear()` |
| `src/pages/AuthPage.tsx` | Chamar restauração do cache após validação offline |

---

### Detalhes Técnicos

**useAuth.tsx - Mudanças principais:**

```typescript
// Nova função para restaurar sessão do cache
const restoreFromCache = async (): Promise<boolean> => {
  const cachedAuth = await authStorage.get();
  const isValid = await authStorage.isValid();
  
  if (cachedAuth && isValid) {
    setUser(cachedAuth.user);
    setSession(cachedAuth.session);
    setProfile(cachedAuth.profile);
    setRole(cachedAuth.role);
    return true;
  }
  return false;
};

// No listener - proteger clear()
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);

  if (session?.user) {
    setTimeout(() => fetchUserData(session.user.id), 0);
  } else {
    setProfile(null);
    setRole(null);
    // SÓ limpar se online - proteger cache offline
    if (isOnline()) {
      authStorage.clear();
    }
  }
});
```

**AuthPage.tsx - Chamar restauração:**

```typescript
// No fluxo offline, após validar email
if (cachedAuth && isValid && emailMatches) {
  // Restaurar sessão no contexto (nova função)
  await restoreFromCache();
  toast.success('Login offline realizado com sucesso!');
  navigate('/');
  return;
}
```

---

### Fluxo Corrigido

```text
+------------------+     +------------------+     +------------------+
|   App Inicia     | --> | Verifica Cache   | --> | Cache Válido?    |
|   (Offline)      |     |   localforage    |     |                  |
+------------------+     +------------------+     +--------+---------+
                                                          |
                              +--------------------+      | Sim
                              |                    | <----+
                              | Define user/session|
                              | do cache local     |
                              +--------+-----------+
                                       |
                                       v
                              +------------------+
                              |  App Funciona    |
                              |    Normalmente   |
                              +------------------+
```

---

### Resultado Esperado

Após as correções:
- O cache será preservado durante uso offline
- Login offline funcionará corretamente validando contra o email cacheado
- O contexto de autenticação será atualizado após login offline bem-sucedido
- Nenhum "loop" de limpeza de cache ocorrerá

