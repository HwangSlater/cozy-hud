// 컨텍스트 부품: 답변이 끝날 때마다 컨텍스트 사용률을 게이지로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CardOptions } from '../types'

/** 경고를 시작할 비율(설정 패널에서 고름). 기본값 */
const WARN_DEFAULT = '80'
const WARN_CHOICES = ['70', '80', '90']
/** 이 비율부터 위험 색 */
const DANGER_PERCENT = 92
const GAUGE_WIDTH = 24
/** 「작게」 모양 한 줄에 들어가는 게이지 폭 */
const COMPACT_GAUGE_WIDTH = 8
const hasWarned = atom({ plugin: 'cozy-hud-context', key: 'hasWarned' } as const, false)
const options = atom({ plugin: 'cozy-hud-context', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)))

async function publish($: EngineInterface) {
  const usage = await $.session.usage()
  const { tokens = 0, window, percent = 0 } = usage.context
  const warnAt = Number((await read($, options)).warn ?? WARN_DEFAULT)
  const tone = percent >= DANGER_PERCENT ? 'err' : percent >= warnAt ? 'warn' : 'accent'
  await $.hud.put({
    id: 'context',
    title: '컨텍스트',
    badge: `${percent}%`,
    lines: [
      [{ gauge: percent / 100, width: GAUGE_WIDTH, tone }, { text: ` ${percent}%`, tone: tone === 'accent' ? 'strong' : tone }],
      [{ text: `${k(tokens)} / ${k(window)} 토큰`, tone: 'dim' }],
    ],
    detail: [[{ text: `남은 공간 ${k(Math.max(0, window - tokens))}`, tone: 'dim' }]],
    compact: [{
      key: 'percent', label: '컨텍스트',
      value: [{ text: `${percent}% `, tone: tone === 'accent' ? 'strong' : tone }, { gauge: percent / 100, width: COMPACT_GAUGE_WIDTH, tone }],
    }],
    brief: [{ text: 'ctx ', tone: 'dim' }, { text: `${percent}%`, tone: tone === 'accent' ? 'dim' : tone }],
    options: [{ key: 'warn', label: '경고 시작', kind: 'choice', value: WARN_DEFAULT, choices: WARN_CHOICES.map(v => ({ value: v, label: `${v}%` })) }],
  })
  // 고비를 넘을 때 한 번만 말하고, 압축 등으로 내려가면 다시 말할 수 있게
  const warned = await read($, hasWarned)
  if (percent >= warnAt && !warned) {
    await update($, hasWarned, () => true)
    await $.hud.say({ kind: 'warn', text: `컨텍스트 ${percent}% 찼어요. 곧 압축돼요` })
  } else if (percent < warnAt && warned) {
    await update($, hasWarned, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($).catch(() => undefined)
    return answer
  })

  // 설정 패널에서 경고 비율을 바꾸면 바로 다시 그린다
  on('hud.option', async ($, e, next) => {
    if (e.card === 'context') {
      await update($, options, () => e.values)
      await publish($).catch(() => undefined)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await publish($).catch(() => undefined)
    return next(e)
  })
}
