// 토큰 부품: 답변이 끝날 때마다 사용량을 쌓아 카드로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CardOptions, TokensTally } from '../types'

/** 쌓아 두는 답변 수(막대그래프에는 설정에서 고른 만큼만 보인다) */
const HISTORY = 48
const OPTIONS = [
  { key: 'bars', label: '막대그래프', kind: 'choice' as const, value: '24', choices: ['12', '24', '48'].map(v => ({ value: v, label: `최근 ${v}개 답변` })) },
  { key: 'brief', label: '입력창 위 요약', kind: 'choice' as const, value: 'both', choices: [
    { value: 'both', label: '이번 답변 + 세션' }, { value: 'last', label: '이번 답변만' }, { value: 'session', label: '세션 합계만' },
  ] },
]
const EMPTY: TokensTally = { output: 0, input: 0, cacheRead: 0, history: [], last: 0, isRunning: false }
const tally = atom({ plugin: 'cozy-hud-tokens', key: 'tally' } as const, EMPTY, { shape: 'tally-1' })
const options = atom({ plugin: 'cozy-hud-tokens', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })

function briefOf(t: TokensTally, mode: string) {
  const last = [{ text: '↓ ', tone: 'dim' as const }, { text: k(t.last), tone: 'accent' as const }]
  const session = [{ text: `세션 ${k(t.output)}`, tone: 'dim' as const }]
  if (mode === 'last') return last
  if (mode === 'session') return session
  return [...last, { text: ' · ', tone: 'dim' as const }, ...session]
}

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
const comma = (n: number) => Math.round(n).toLocaleString('en-US')

async function publish($: EngineInterface) {
  const t = await read($, tally)
  const o = await read($, options)
  const bars = t.history.slice(-Number(o.bars ?? '24'))
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
      bars.length ? [{ text: '답변별     ', tone: 'dim' }, { spark: bars, tone: 'accent' }] : [{ text: '아직 끝난 답변이 없어요', tone: 'dim' }],
    ],
    brief: briefOf(t, o.brief ?? 'both'),
    options: OPTIONS,
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($)
    return answer
  })

  // 설정 패널에서 고른 값이 오면 바로 다시 그린다
  on('hud.option', async ($, e, next) => {
    if (e.card === 'tokens') {
      await update($, options, () => e.values)
      await publish($)
    }
    return next(e)
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
