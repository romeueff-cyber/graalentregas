export function isAbortErrorLike(err: unknown): boolean {
  const anyErr = err as any;
  const message = String(anyErr?.message ?? '');
  const causeMessage = String(anyErr?.cause?.message ?? '');

  return (
    anyErr?.name === 'AbortError' ||
    anyErr?.cause?.name === 'AbortError' ||
    /signal is aborted/i.test(message) ||
    /signal is aborted/i.test(causeMessage) ||
    /abort/i.test(message) ||
    /abort/i.test(causeMessage)
  );
}

/**
 * Converte erros comuns do login em mensagens amigáveis.
 * Objetivo: nunca exibir mensagens técnicas como "signal is aborted...".
 */
export function toFriendlyAuthError(err: unknown): string {
  const anyErr = err as any;
  const message = String(anyErr?.message ?? '').trim();

  if (isAbortErrorLike(err)) return 'Conexão interrompida. Tente novamente.';
  if (/Invalid login credentials/i.test(message)) return 'Email ou senha incorretos';

  return message || 'Erro ao fazer login';
}
