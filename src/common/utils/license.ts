/**
 * Utilitários de validade da CNH do motorista.
 * Regra de negócio: motorista com CNH vencida não pode pegar/aceitar viagens.
 */

/** True se a CNH possui data de validade registrada e ela já passou. */
export function isLicenseExpired(licenseExpiry: Date | string | null | undefined): boolean {
  if (!licenseExpiry) return false // sem registro: não bloqueia (permissivo p/ cadastros legados)
  return new Date(licenseExpiry).getTime() < Date.now()
}

/** Mensagem padrão exibida ao motorista com CNH vencida. */
export const LICENSE_EXPIRED_MESSAGE =
  'Sua CNH está vencida. Atualize a data de validade no seu perfil para aceitar viagens.'
