// 사용량 부품: 5시간·주간 사용 한도와 리셋까지 남은 시간, 이번 답변·세션 시간과 비용을 카드로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { CardOptions, UsageLast } from '../types'

const GAUGE_WIDTH = 16
const COMPACT_GAUGE_WIDTH = 6
/** 이 비율부터 경고색·위험색 */
const WARN_PERCENT = 80
const DANGER_PERCENT = 95
/** 리셋까지 남은 시간을 다시 그리는 간격 */
const TICK_MS = 60_000
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** 한도 이름: 엔진이 주는 kind → 화면에 보일 이름 */
const LIMIT_NAMES: Readonly<Record<string, string>> = { five_hour: '5시간', seven_day: '주간', spend_limit: '지출 한도' }
const SHORT_NAMES: Readonly<Record<string, string>> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }

const last = atom({ plugin: 'cozy-hud-usage', key: 'last' } as const, { durationMs: 0 } as UsageLast, { shape: 'last-1' })
const hasWarned = atom({ plugin: 'cozy-hud-usage', key: 'hasWarned' } as const, false)
const options = atom({ plugin: 'cozy-hud-usage', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })
const mem = { isTicking: false }

/** 「1분 20초」, 「48분」, 「2시간 13분」 */
export function spanText(ms: number) {
  const m = Math.floor(ms / MINUTE)
  if (m < 1) return `${Math.max(0, Math.round(ms / 1000))}초`
  if (ms < 10 * MINUTE) {
    const s = Math.round((ms % MINUTE) / 1000)
    return s ? `${m}분 ${s}초` : `${m}분`
  }
  const h = Math.floor(m / 60)
  return h ? `${h}시간 ${m % 60}분` : `${m}분`
}

/** 리셋까지 남은 시간: 「13분 뒤」, 「2시간 13분 뒤」, 「1일 5시간 뒤」, 「4일 뒤」 */
export function untilText(resetsAt: string | undefined, now: number) {
  if (!resetsAt) return ''
  const left = Date.parse(resetsAt) - now
  if (!(left > 0)) return '곧 리셋'
  if (left >= 2 * DAY) return `${Math.floor(left / DAY)}일 뒤 리셋`
  if (left >= DAY) return `1일 ${Math.floor((left - DAY) / HOUR)}시간 뒤 리셋`
  if (left >= HOUR) return `${Math.floor(left / HOUR)}시간 ${Math.floor((left % HOUR) / MINUTE)}분 뒤 리셋`
  return `${Math.max(1, Math.ceil(left / MINUTE))}분 뒤 리셋`
}

/** 터미널 칸 수(한글은 2칸) */
const cells = (text: string) => [...text].reduce((n, ch) => n + (/[가-힣]/.test(ch) ? 2 : 1), 0)
const toneOf = (p: number) => (p >= DANGER_PERCENT ? 'err' : p >= WARN_PERCENT ? 'warn' : 'accent') as 'err' | 'warn' | 'accent'
const nameOf = (l: SessionRateLimit) => LIMIT_NAMES[l.kind] ?? l.kind

async function publish($: EngineInterface) {
  const usage = await $.session.usage()
  const now = await $.clock.now()
  const showCost = ((await read($, options)).cost ?? 'on') === 'on'
  const limits = usage.rateLimits
  const lastMs = (await read($, last)).durationMs
  const cost = usage.cost ? `$${usage.cost.usd.toFixed(2)}` : ''
  const facts = [lastMs ? `이번 답변 ${spanText(lastMs)}` : '', `세션 ${spanText(now - usage.startedAt)}`, showCost ? cost : ''].filter(Boolean).join(' · ')
  const width = Math.max(...limits.map(l => cells(nameOf(l))), 4) + 2
  const lines = limits.map(l => {
    const tone = toneOf(l.percentUsed)
    return [
      { text: nameOf(l) + ' '.repeat(width - cells(nameOf(l))) },
      { gauge: Math.min(1, l.percentUsed / 100), width: GAUGE_WIDTH, tone },
      { text: ` ${Math.round(l.percentUsed)}%`, tone: tone === 'accent' ? 'strong' as const : tone },
      { text: `  ${untilText(l.resetsAt, now)}`, tone: 'dim' as const },
    ]
  })
  const main = limits.find(l => l.kind === 'five_hour') ?? limits[0]
  await $.hud.put({
    id: 'usage',
    title: '사용량',
    badge: main ? `${nameOf(main)} ${Math.round(main.percentUsed)}%` : showCost ? cost : '',
    lines: [
      ...(lines.length ? lines : [[{ text: '한도는 첫 답변 뒤에 보여요', tone: 'dim' as const }]]),
      [{ text: facts, tone: 'dim' }],
    ],
    compact: [
      ...limits.map(l => ({
        key: l.kind, label: nameOf(l),
        value: [
          { text: `${Math.round(l.percentUsed)}% `, tone: toneOf(l.percentUsed) === 'accent' ? 'strong' as const : toneOf(l.percentUsed) },
          { gauge: Math.min(1, l.percentUsed / 100), width: COMPACT_GAUGE_WIDTH, tone: toneOf(l.percentUsed) },
        ],
      })),
      ...(showCost && cost ? [{ key: 'cost', label: '비용', value: [{ text: cost, tone: 'strong' as const }] }] : []),
    ],
    brief: main ? [{ text: `${SHORT_NAMES[main.kind] ?? ''} `, tone: 'dim' }, { text: `${Math.round(main.percentUsed)}%`, tone: toneOf(main.percentUsed) === 'accent' ? 'dim' : toneOf(main.percentUsed) }] : [],
    options: [{ key: 'cost', label: '비용 보이기', kind: 'choice', value: 'on', choices: [{ value: 'on', label: '보이기' }, { value: 'off', label: '숨기기' }] }],
  })
  // 5시간 한도가 위험 선을 넘을 때 한 번만 말한다(리셋돼 내려가면 다시 말할 수 있게)
  const warned = await read($, hasWarned)
  if (main && main.percentUsed >= WARN_PERCENT && !warned) {
    await update($, hasWarned, () => true)
    await $.hud.say({ kind: 'warn', text: `${nameOf(main)} 한도 ${Math.round(main.percentUsed)}% 썼어요 · ${untilText(main.resetsAt, now)}` })
  } else if (main && main.percentUsed < WARN_PERCENT && warned) {
    await update($, hasWarned, () => false)
  }
  // 리셋까지 남은 시간이 흘러가도록 1분마다 다시 그린다(한도가 있을 때만)
  if (limits.length && !mem.isTicking) {
    mem.isTicking = true
    $.clock.every(TICK_MS, () => void publish($).catch(() => undefined))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($).catch(() => undefined)
    return answer
  })

  on('hud.option', async ($, e, next) => {
    if (e.card === 'usage') {
      await update($, options, () => e.values)
      await publish($).catch(() => undefined)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, last, () => ({ durationMs: e.durationMs }))
      await publish($).catch(() => undefined)
    }
    return next(e)
  })
}
