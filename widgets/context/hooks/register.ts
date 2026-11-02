// 컨텍스트 부품: 답변이 끝날 때마다 컨텍스트 사용률을 게이지로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/** 이 비율부터 경고 색 · 캐릭터 경고 */
const WARN_PERCENT = 80
/** 이 비율부터 위험 색 */
const DANGER_PERCENT = 92
const GAUGE_WIDTH = 24
const hasWarned = atom({ plugin: 'cozy-hud-context', key: 'hasWarned' } as const, false)

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)))

async function publish($: EngineInterface) {
  const usage = await $.session.usage()
  const { tokens = 0, window, percent = 0 } = usage.context
  const tone = percent >= DANGER_PERCENT ? 'err' : percent >= WARN_PERCENT ? 'warn' : 'accent'
  await $.hud.put({
    id: 'context',
    title: '컨텍스트',
    badge: `${percent}%`,
    lines: [
      [{ gauge: percent / 100, width: GAUGE_WIDTH, tone }, { text: ` ${percent}%`, tone: tone === 'accent' ? 'strong' : tone }],
      [{ text: `${k(tokens)} / ${k(window)} 토큰 · 남은 공간 ${k(Math.max(0, window - tokens))}`, tone: 'dim' }],
    ],
    brief: [{ text: 'ctx ', tone: 'dim' }, { text: `${percent}%`, tone: tone === 'accent' ? 'dim' : tone }],
  })
  // 고비를 넘을 때 한 번만 말하고, 압축 등으로 내려가면 다시 말할 수 있게
  const warned = await read($, hasWarned)
  if (percent >= WARN_PERCENT && !warned) {
    await update($, hasWarned, () => true)
    await $.hud.say({ kind: 'warn', text: `컨텍스트 ${percent}% 찼어요. 곧 압축돼요` })
  } else if (percent < WARN_PERCENT && warned) {
    await update($, hasWarned, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($).catch(() => undefined)
    return answer
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await publish($).catch(() => undefined)
    return next(e)
  })
}
