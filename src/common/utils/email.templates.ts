const BASE_URL = process.env.CORS_ORIGIN || ''
const LOGO_URL = `${BASE_URL}/logo-email.png`

// ─── Layout base ───────────────────────────────────────────────────────────
// Tabelas em vez de flex/grid — compatível com Outlook e clientes de e-mail
// legados. Cores seguem a paleta da marca (dourado + carvão escuro) usada no
// site; o corpo do card fica claro para garantir legibilidade em qualquer
// cliente, com o cabeçalho escuro carregando a identidade visual.
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4efe4;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe4;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(20,16,8,.10)">

          <!-- accent bar -->
          <tr><td style="height:4px;background:#a98549;font-size:0;line-height:0">&nbsp;</td></tr>

          <!-- header -->
          <tr>
            <td style="background:#111009;padding:28px 32px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px">
                    <img src="${LOGO_URL}" width="54" height="24" alt="Serra Experience" style="display:block;border:0">
                  </td>
                  <td style="font-family:Georgia,'Times New Roman',serif;color:#dac787;font-size:20px;font-weight:700;letter-spacing:.4px;vertical-align:middle">
                    Serra&nbsp;Experience
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:34px 32px 28px">
              <h1 style="margin:0 0 18px;color:#1c1710;font-size:19px;font-weight:700;letter-spacing:-.2px">${title}</h1>
              ${body}
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:18px 32px 26px;background:#faf7f0;border-top:1px solid #ece3d2">
              <p style="margin:0 0 4px;color:#8a7f6b;font-size:12px;line-height:1.6">Serra Experience &middot; Motoristas particulares em Nova Friburgo e Serra Carioca</p>
              <p style="margin:0;color:#b3a893;font-size:11px;line-height:1.6">Esta é uma mensagem automática. Não é possível responder este e-mail.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="color:#4b463c;font-size:14px;line-height:1.6;margin:0 0 16px">${text}</p>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 14px;background:#f7f3ea;color:#8a7f6b;font-size:12px;font-weight:600;width:38%;border-radius:6px 0 0 6px;vertical-align:top">${label}</td>
    <td style="padding:10px 14px;background:#f7f3ea;color:#1c1710;font-size:13px;border-radius:0 6px 6px 0;vertical-align:top">${value}</td>
  </tr>`
}

function table(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin:4px 0 18px">${rows}</table>`
}

function btn(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px">
    <tr><td style="border-radius:8px;background:#a98549">
      <a href="${href}" style="display:inline-block;padding:13px 28px;color:#0a0908;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">${label}</a>
    </td></tr>
  </table>`
}

function linkFallback(href: string): string {
  return `<p style="margin:8px 0 0;color:#a39a89;font-size:12px;line-height:1.6">Se o botão não funcionar, copie e cole este link no navegador:<br><a href="${href}" style="color:#8a6c39;word-break:break-all">${href}</a></p>`
}

function alert(text: string, color = '#c9962c'): string {
  return `<div style="border-left:3px solid ${color};background:${color}14;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:18px;color:#4b463c;font-size:13px;line-height:1.55">${text}</div>`
}

// ─── Código de verificação em destaque (OTP) ──────────────────────────────
function otpBox(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#faf6ea;border:1.5px solid #e6d7ac;border-radius:12px">
        <tr><td style="padding:18px 30px">
          <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#1c1710">${code}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>`
}

// ─── Autenticação: código de verificação (cadastro / reenvio) ────────────────
export function tplOtpVerification(data: { code: string; expiryMinutes: number }): { subject: string; html: string } {
  const body = `
    ${p('Use o código abaixo para confirmar seu e-mail e concluir o cadastro na Serra Experience.')}
    ${otpBox(data.code)}
    ${alert(`Este código expira em <strong>${data.expiryMinutes} minutos</strong>. Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.`)}
  `
  return { subject: 'Seu código de verificação — Serra Experience', html: shell('Confirme seu e-mail', body) }
}

// ─── Autenticação: redefinição de senha ──────────────────────────────────────
export function tplPasswordReset(data: { resetUrl: string; expiryMinutes: number }): { subject: string; html: string } {
  const hours = Math.round(data.expiryMinutes / 60)
  let expiryText = `${data.expiryMinutes} minutos`
  if (hours >= 1) expiryText = hours === 1 ? '1 hora' : `${hours} horas`
  const body = `
    ${p('Recebemos uma solicitação para redefinir a senha da sua conta na Serra Experience.')}
    ${btn('Redefinir minha senha', data.resetUrl)}
    ${linkFallback(data.resetUrl)}
    ${alert(`Este link expira em <strong>${expiryText}</strong>. Se você não solicitou a troca de senha, pode ignorar este e-mail com segurança.`, '#9b3030')}
  `
  return { subject: 'Redefinição de senha — Serra Experience', html: shell('Redefinir sua senha', body) }
}

// ─── A1: Novo motorista aguardando aprovação ──────────────────────────────────
export function tplNovoMotorista(data: {
  driverName: string
  driverEmail: string
  registeredAt: Date
}): { subject: string; html: string } {
  const date = data.registeredAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const body = `
    ${p('Um novo motorista se cadastrou e aguarda aprovação para começar a operar.')}
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
    ${p('Um motorista aprovado alterou dados do seu veículo. O cadastro foi marcado como <strong>Em Revisão</strong>.')}
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
    ${p('Um usuário enviou um documento de identidade e aguarda verificação.')}
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
    ${p('Uma anomalia foi detectada no processamento de pagamento. Verifique o log de pagamentos imediatamente.')}
    ${table(rows.join(''))}
    ${alert('Esta situação pode indicar tentativa de fraude ou inconsistência na integração PicPay. Revise antes de confirmar a viagem.', '#9b3030')}
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
    ${p(`Uma viagem foi cancelada por <strong>${who}</strong>.`)}
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
    ${data.hadPayment ? alert('Esta viagem havia sido paga. O reembolso foi marcado automaticamente. Verifique se o estorno foi processado.', '#9b3030') : ''}
    ${btn('Ver detalhes da viagem', `${BASE_URL}/admin/trips`)}
  `
  return { subject: '❌ Viagem cancelada', html: shell('Viagem cancelada', body) }
}

// ─── A6: Viagem recusada pelo motorista ───────────────────────────────────────
export function tplViagemRecusada(data: {
  driverName: string
  passengerName: string
  origin: string
  destination: string
  scheduledAt: Date
  reason?: string
}): { subject: string; html: string } {
  const scheduled = data.scheduledAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const body = `
    ${p(`<strong>${data.driverName}</strong> recusou uma viagem já atribuída. É necessário encontrar outro motorista.`)}
    ${table(
      row('Motorista', data.driverName) +
      row('Passageiro', data.passengerName) +
      row('Origem', data.origin) +
      row('Destino', data.destination) +
      row('Agendada para', scheduled) +
      (data.reason ? row('Motivo', data.reason) : '')
    )}
    ${alert('Esta viagem precisa de um novo motorista o quanto antes.', '#9b3030')}
    ${btn('Gerenciar orçamentos', `${BASE_URL}/admin/quotes`)}
  `
  return { subject: '⚠️ Viagem recusada — ação necessária', html: shell('Viagem recusada pelo motorista', body) }
}

// ─── U10: Lembrete de viagem confirmada (motorista) ──────────────────────────
export function tplLembreteViagemMotorista(data: {
  tripId: string
  driverName: string
  passengerName: string
  origin: string
  destination: string
  scheduledAt: Date
  when: 'VESPERA' | 'UMA_HORA'
}): { subject: string; html: string } {
  const scheduled = data.scheduledAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const headline = data.when === 'VESPERA'
    ? 'Você tem uma viagem agendada para amanhã.'
    : 'Sua viagem começa em aproximadamente 1 hora.'
  const body = `
    ${p(`Olá, <strong>${data.driverName}</strong>!`)}
    ${p(headline)}
    ${table(
      row('Passageiro', data.passengerName) +
      row('Origem', data.origin) +
      row('Destino', data.destination) +
      row('Agendada para', scheduled)
    )}
    ${btn('Ver minha viagem', `${BASE_URL}/driver/trips/${data.tripId}`)}
  `
  const subject = data.when === 'VESPERA'
    ? '📅 Lembrete: viagem amanhã'
    : '⏰ Lembrete: viagem em 1 hora'
  return { subject, html: shell('Lembrete de viagem', body) }
}

// ─── U6: Motorista aprovado ou rejeitado ─────────────────────────────────────
export function tplMotoristaAprovado(data: {
  driverName: string
  approved: boolean
}): { subject: string; html: string } {
  if (data.approved) {
    const body = `
      ${p(`Olá, <strong>${data.driverName}</strong>!`)}
      ${p('Sua conta de motorista foi <strong>aprovada</strong>. Você já pode receber corridas pela plataforma.')}
      ${alert('Acesse o aplicativo, habilite sua disponibilidade e comece a receber orçamentos.', '#2e7d5e')}
      ${btn('Acessar plataforma', BASE_URL)}
    `
    return { subject: '✅ Sua conta de motorista foi aprovada!', html: shell('Conta aprovada — bem-vindo!', body) }
  }

  const body = `
    ${p(`Olá, <strong>${data.driverName}</strong>!`)}
    ${p('Após análise, sua conta de motorista <strong>não foi aprovada</strong> neste momento.')}
    ${alert('Se acredita que houve um engano ou deseja mais informações, entre em contato com nosso suporte.', '#9b3030')}
    ${btn('Falar com suporte', BASE_URL)}
  `
  return { subject: '❌ Conta de motorista não aprovada', html: shell('Resultado da avaliação', body) }
}

// ─── U8: Viagem confirmada com motorista (passageiro) ────────────────────────
export function tplViagemConfirmadaPassageiro(data: {
  passengerName: string
  tripId: string
  driverName: string
  vehicleInfo: string
  origin: string
  destination: string
  scheduledAt: Date
}): { subject: string; html: string } {
  const scheduled = data.scheduledAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const body = `
    ${p(`Olá, <strong>${data.passengerName}</strong>!`)}
    ${p('Sua viagem foi <strong>confirmada</strong> e já tem motorista definido.')}
    ${table(
      row('Motorista', data.driverName) +
      row('Veículo', data.vehicleInfo) +
      row('Origem', data.origin) +
      row('Destino', data.destination) +
      row('Agendada para', scheduled)
    )}
    ${alert('O pagamento é acertado diretamente com a central, fora do site.', '#2e7d5e')}
    ${btn('Ver minha viagem', `${BASE_URL}/trips/${data.tripId}`)}
  `
  return { subject: '✅ Sua viagem foi confirmada!', html: shell('Viagem confirmada', body) }
}

// ─── U9: Viagem concluída — convite para avaliar (passageiro) ────────────────
export function tplViagemConcluidaPassageiro(data: {
  passengerName: string
  tripId: string
  driverName: string
}): { subject: string; html: string } {
  const body = `
    ${p(`Olá, <strong>${data.passengerName}</strong>!`)}
    ${p(`Sua viagem com <strong>${data.driverName}</strong> foi concluída. Esperamos que tenha sido uma ótima experiência!`)}
    ${alert('Sua avaliação ajuda a manter a qualidade do serviço — leva menos de 1 minuto.', '#2e7d5e')}
    ${btn('Avaliar viagem', `${BASE_URL}/trips/${data.tripId}/review`)}
  `
  return { subject: '⭐ Como foi sua viagem? Avalie agora', html: shell('Viagem concluída', body) }
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
    ${p(`Olá, <strong>${data.driverName}</strong>!`)}
    ${p(`Você recebeu uma nova avaliação de <strong>${data.passengerName}</strong>.`)}
    ${table(
      row('Nota', `<span style="color:#c9962c;font-size:18px">${stars}</span> &nbsp;${data.rating}/5`) +
      row('Comentário', data.comment || '<em style="color:#a39a89">Sem comentário</em>') +
      row('Sua média atual', `${data.newAverage.toFixed(2)} / 5.00`)
    )}
    ${btn('Ver minhas avaliações', `${BASE_URL}/driver/profile`)}
  `
  return { subject: `⭐ Nova avaliação: ${data.rating}/5`, html: shell('Você recebeu uma avaliação', body) }
}
