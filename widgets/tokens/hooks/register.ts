// 토큰 부품: 답변이 끝날 때마다 사용량을 쌓아 카드로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TokensTally } from '../types'

/** 막대그래프에 남길 답변 수 */
const HISTORY = 24
const EMPTY: TokensTally = { output: 0, input: 0, cacheRead: 0, history: [], last: 0, isRunning: false }
const tally = atom({ plugin: 'cozy-hud-tokens', key: 'tally' } as const, EMPTY, { shape: 'tally-1' })

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
const comma = (n: number) => Math.round(n).toLocaleString('en-US')

async function publish($: EngineInterface) {
  const t = await read($, tally)
  await $.hud.put({
    id: 'tokens',
    title: '토큰',
    badge: t.isRunning ? '답변 중' : undefined,
    lines: [
      [{ text: '이번 답변  ', tone: 'dim' }, { text: '출력 ' }, { text: comma(t.last), tone: 'strong' }],
      [
        { text: '세션 합계  ', tone: 'dim' }, { text: '출력 ' }, { text: k(t.output), tone: 'strong' },
        { text: '  입력 ', tone: 'dim' }, { text: k(t.input) }, { text: '  캐시 ', tone: 'dim' }, { text: k(t.cacheRead), tone: 'dim' },
      ],
      t.history.length ? [{ text: '답변별     ', tone: 'dim' }, { spark: t.history, tone: 'accent' }] : [{ text: '아직 끝난 답변이 없어요', tone: 'dim' }],
    ],
    brief: [{ text: '↓ ', tone: 'dim' }, { text: k(t.last), tone: 'accent' }, { text: ` · 세션 ${k(t.output)}`, tone: 'dim' }],
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($)
    return answer
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, tally, t => ({ ...t, isRunning: true }))
      await publish($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const u = e.usage
      await update($, tally, t => ({
        output: t.output + (u?.output_tokens ?? 0),
        input: t.input + (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0),
        cacheRead: t.cacheRead + (u?.cache_read_input_tokens ?? 0),
        history: [...t.history, u?.output_tokens ?? 0].slice(-HISTORY),
        last: u?.output_tokens ?? 0,
        isRunning: false,
      }))
      await publish($)
    }
    return next(e)
  })
}
