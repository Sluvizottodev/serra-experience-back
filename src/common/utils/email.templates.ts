const BASE_URL = process.env.CORS_ORIGIN || ''

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:580px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.10)">
    <div style="background:#111827;padding:24px 32px;display:flex;align-items:center">
      <span style="color:#c9a84c;font-size:22px;font-weight:700;letter-spacing:.5px">Serra Experience</span>
    </div>
    <div style="padding:32px 32px 24px">
      <h2 style="margin:0 0 20px;color:#111827;font-size:18px;font-weight:700">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">Esta é uma mensagem automática do sistema Serra Experience. Não responda este e-mail.</p>
    </div>
  </div>
</body>
</html>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;background:#f3f4f6;color:#6b7280;font-size:13px;font-weight:600;width:38%;border-radius:4px 0 0 4px">${label}</td>
    <td style="padding:8px 12px;color:#111827;font-size:13px;border-radius:0 4px 4px 0">${value}</td>
  </tr>`
}

function table(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="4" style="border-collapse:separate;border-spacing:0 4px;margin:16px 0">${rows}</table>`
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px">${label}</a>`
}

function alert(text: string, color = '#f59e0b'): string {
  return `<div style="border-left:4px solid ${color};background:${color}18;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:16px;color:#374151;font-size:14px">${text}</div>`
}

// ─── A1: Novo motorista aguardando aprovação ──────────────────────────────────
export function tplNovoMotorista(data: {
  driverName: string
  driverEmail: string
  registeredAt: Date
}): { subject: string; html: string } {
  const date = data.registeredAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Um novo motorista se cadastrou e aguarda aprovação para começar a operar.</p>
    ${table(
      row('Nome', data.driverName) +
      row('E-mail', data.driverEmail) +
      row('Cadastrado em', date)
    )}
    ${alert('Este motorista ainda não pode receber corridas até ser aprovado.')}
    ${btn('Revisar motorista', `${BASE_URL}/admin/drivers`)}
  `
  return { subject: '🚗 Novo motorista aguardando aprovação', html: shell('Novo motorista cadastrado', body) }
}

// ─── A2: Veículo de motorista em revisão ──────────────────────────────────────
export function tplVeiculoEmRevisao(data: {
  driverName: string
  driverEmail: string
  driverProfileId: string
  changedFields: string[]
}): { subject: string; html: string } {
  const fields = data.changedFields.join(', ')
  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Um motorista aprovado alterou dados do seu veículo. O cadastro foi marcado como <strong>Em Revisão</strong>.</p>
    ${table(
      row('Motorista', data.driverName) +
      row('E-mail', data.driverEmail) +
      row('Campos alterados', fields)
    )}
    ${alert('O motorista continua ativo até que a revisão seja concluída. Verifique os novos dados e aprove ou corrija.')}
    ${btn('Revisar veículo', `${BASE_URL}/admin/drivers`)}
  `
  return { subject: '🔍 Veículo em revisão — ação necessária', html: shell('Dados de veículo para revisão', body) }
}

// ─── A3: Documento de identidade enviado ─────────────────────────────────────
export function tplDocumentoEnviado(data: {
  userName: string
  userEmail: string
  userId: string
}): { subject: string; html: string } {
  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Um usuário enviou um documento de identidade e aguarda verificação.</p>
    ${table(
      row('Usuário', data.userName) +
      row('E-mail', data.userEmail)
    )}
    ${alert('O documento precisa ser aprovado ou rejeitado antes que o usuário possa usar funções restritas.')}
    ${btn('Verificar documento', `${BASE_URL}/admin/users`)}
  `
  return { subject: '📄 Documento de identidade aguardando verificação', html: shell('Documento enviado para revisão', body) }
}

// ─── A4: Falha ou inconsistência de pagamento ─────────────────────────────────
export function tplFalhaPagamento(data: {
  referenceId: string
  tripId: string
  reason: string
  expectedAmount?: number
  receivedAmount?: number
}): { subject: string; html: string } {
  const rows = [
    row('Referência PicPay', data.referenceId),
    row('ID da Viagem', data.tripId),
    row('Motivo', data.reason),
  ]
  if (data.expectedAmount !== undefined) rows.push(row('Valor esperado', `R$ ${data.expectedAmount.toFixed(2)}`))
  if (data.receivedAmount !== undefined) rows.push(row('Valor recebido', `R$ ${data.receivedAmount.toFixed(2)}`))

  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Uma anomalia foi detectada no processamento de pagamento. Verifique o log de pagamentos imediatamente.</p>
    ${table(rows.join(''))}
    ${alert('Esta situação pode indicar tentativa de fraude ou inconsistência na integração PicPay. Revise antes de confirmar a viagem.', '#ef4444')}
    ${btn('Ver logs de pagamento', `${BASE_URL}/admin/payments`)}
  `
  return { subject: '⚠️ Alerta: falha em pagamento', html: shell('Problema em pagamento detectado', body) }
}

// ─── A5: Viagem cancelada ────────────────────────────────────────────────────
export function tplViagemCancelada(data: {
  tripId: string
  cancelledBy: 'PASSENGER' | 'DRIVER' | 'ADMIN'
  passengerName: string
  driverName: string
  origin: string
  destination: string
  scheduledAt: Date
  cancelReason: string | null
  hadPayment: boolean
}): { subject: string; html: string } {
  const who = { PASSENGER: 'Passageiro', DRIVER: 'Motorista', ADMIN: 'Administrador' }[data.cancelledBy]
  const scheduled = data.scheduledAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Uma viagem foi cancelada por <strong>${who}</strong>.</p>
    ${table(
      row('ID da viagem', data.tripId) +
      row('Cancelado por', who) +
      row('Passageiro', data.passengerName) +
      row('Motorista', data.driverName) +
      row('Origem', data.origin) +
      row('Destino', data.destination) +
      row('Agendada para', scheduled) +
      row('Motivo', data.cancelReason || '—')
    )}
    ${data.hadPayment ? alert('Esta viagem havia sido paga. O reembolso foi marcado automaticamente. Verifique se o estorno foi processado.', '#ef4444') : ''}
    ${btn('Ver detalhes da viagem', `${BASE_URL}/admin/trips`)}
  `
  return { subject: '❌ Viagem cancelada', html: shell('Viagem cancelada', body) }
}

// ─── U6: Motorista aprovado ou rejeitado ─────────────────────────────────────
export function tplMotoristaAprovado(data: {
  driverName: string
  approved: boolean
}): { subject: string; html: string } {
  if (data.approved) {
    const body = `
      <p style="color:#374151;font-size:14px;margin:0 0 16px">Olá, <strong>${data.driverName}</strong>!</p>
      <p style="color:#374151;font-size:14px;margin:0 0 16px">Sua conta de motorista foi <strong>aprovada</strong>. Você já pode receber corridas pela plataforma.</p>
      ${alert('Acesse o aplicativo, habilite sua disponibilidade e comece a receber orçamentos.', '#10b981')}
      ${btn('Acessar plataforma', BASE_URL)}
    `
    return { subject: '✅ Sua conta de motorista foi aprovada!', html: shell('Conta aprovada — bem-vindo!', body) }
  }

  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Olá, <strong>${data.driverName}</strong>!</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Após análise, sua conta de motorista <strong>não foi aprovada</strong> neste momento.</p>
    ${alert('Se acredita que houve um engano ou deseja mais informações, entre em contato com nosso suporte.', '#ef4444')}
    ${btn('Falar com suporte', BASE_URL)}
  `
  return { subject: '❌ Conta de motorista não aprovada', html: shell('Resultado da avaliação', body) }
}

// ─── U7: Nova avaliação recebida ─────────────────────────────────────────────
export function tplNovaAvaliacao(data: {
  driverName: string
  passengerName: string
  rating: number
  comment: string | null
  newAverage: number
}): { subject: string; html: string } {
  const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating)
  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Olá, <strong>${data.driverName}</strong>!</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">Você recebeu uma nova avaliação de <strong>${data.passengerName}</strong>.</p>
    ${table(
      row('Nota', `<span style="color:#f59e0b;font-size:18px">${stars}</span> &nbsp;${data.rating}/5`) +
      row('Comentário', data.comment || '<em style="color:#9ca3af">Sem comentário</em>') +
      row('Sua média atual', `${data.newAverage.toFixed(2)} / 5.00`)
    )}
    ${btn('Ver minhas avaliações', `${BASE_URL}/driver/profile`)}
  `
  return { subject: `⭐ Nova avaliação: ${data.rating}/5`, html: shell('Você recebeu uma avaliação', body) }
}
