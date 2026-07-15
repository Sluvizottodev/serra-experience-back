/**
 * IndexNow — notifica motores de busca (Bing, Yandex, etc.) instantaneamente
 * quando uma URL do site é criada, atualizada ou removida, acelerando a
 * (re)indexação de semanas para minutos/horas.
 *
 * Docs: https://www.indexnow.org/documentation
 *
 * A chave é um valor arbitrário; o mesmo valor precisa ser servido em
 * https://serraexperience.com.br/<KEY>.txt (ver rota em app.ts) para o
 * mecanismo validar a propriedade do domínio.
 */

const SITE_HOST = 'serraexperience.com.br'
const SITE_URL = `https://${SITE_HOST}`

// Chave do IndexNow. Defina INDEXNOW_KEY no ambiente (Vercel → Settings → Env).
// Fallback só para não quebrar em dev; em produção use uma chave própria.
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? ''

/**
 * Envia uma ou mais URLs ao IndexNow. Nunca lança — falha de SEO não deve
 * derrubar a operação de negócio que a disparou. Roda "fire-and-forget".
 */
export async function pingIndexNow(paths: string | string[]): Promise<void> {
  if (!INDEXNOW_KEY) return // sem chave configurada → no-op silencioso

  const list = (Array.isArray(paths) ? paths : [paths]).map(p =>
    p.startsWith('http') ? p : `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`,
  )
  if (list.length === 0) return

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
    })
  } catch {
    // rede indisponível / timeout: ignora de propósito
  }
}
