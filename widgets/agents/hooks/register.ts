// 서브에이전트 부품: 돌고 있는 에이전트마다 이름·지금 하는 일·걸린 시간을 카드로 보낸다.
// 에이전트가 없으면 카드를 내리고, 끝난 것은 잠깐 보였다가 사라진다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentEntry, AgentList, AgentStatus } from '../types'

/** 끝난 에이전트를 이만큼 더 보인다 */
const LINGER_MS = 10_000
/** 걸린 시간을 다시 그리는 간격(돌고 있을 때만) */
const TICK_MS = 2000
/** 카드에 보일 최대 줄 수(넘으면 「+n개 더」) */
const MAX_LINES = 5
const NAME_MAX = 16
const DOING_MAX = 20

/** 에이전트가 쓰는 도구 → 지금 하는 일 */
const DOING: Readonly<Record<string, string>> = {
  Read: '읽는 중', Edit: '고치는 중', Write: '쓰는 중', Bash: '실행하는 중', PowerShell: '실행하는 중',
  Grep: '찾는 중', Glob: '찾는 중', WebFetch: '웹 읽는 중', WebSearch: '검색하는 중',
}
const MARK: Readonly<Record<AgentStatus, { text: string; tone: 'accent' | 'ok' | 'warn' | 'dim' }>> = {
  running: { text: '◐ ', tone: 'accent' }, done: { text: '✓ ', tone: 'ok' }, stopped: { text: '■ ', tone: 'warn' }, idle: { text: '· ', tone: 'dim' },
}

const list = atom({ plugin: 'cozy-hud-agents', key: 'list' } as const, [] as AgentList, { shape: 'list-1' })
const mem = { ticker: null as { cancel: () => void } | null }

const clip = (s: string, n: number) => ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s)

/** 「0:24」, 「1:12」, 「1:02:05」 */
export function clockText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 보일 것: 돌고 있거나 쉬는 것, 그리고 끝난 지 얼마 안 된 것 */
export function visible(entries: AgentList, now: number) {
  return entries.filter(a => a.status === 'running' || a.status === 'idle' || (a.endedAt !== undefined && now - a.endedAt < LINGER_MS))
}

async function publish($: EngineInterface) {
  const now = await $.clock.now()
  const shown = visible(await read($, list), now)
  const running = shown.filter(a => a.status === 'running')
  if (running.length === 0) {
    mem.ticker?.cancel()
    mem.ticker = null
  } else if (!mem.ticker) {
    mem.ticker = $.clock.every(TICK_MS, () => void publish($).catch(() => undefined))
  }
  if (shown.length === 0) {
    await $.hud.drop({ id: 'agents' })
    return
  }
  // 끝난 것만 남았으면 사라질 때 한 번 더 그려 카드를 내린다
  if (running.length === 0) $.clock.after(LINGER_MS, () => void publish($).catch(() => undefined))
  const lines = shown.slice(0, MAX_LINES).map(a => [
    { text: MARK[a.status].text, tone: MARK[a.status].tone },
    { text: `${clip(a.name, NAME_MAX)}  `, tone: 'strong' as const },
    { text: a.status === 'running' ? clip(a.doing, DOING_MAX) : a.status === 'idle' ? '쉬는 중' : a.status === 'stopped' ? '멈춤' : '끝남', tone: a.status === 'running' ? 'text' as const : 'dim' as const },
    { text: `  ${clockText((a.endedAt ?? now) - a.startedAt)}`, tone: 'dim' as const },
  ])
  const more = shown.length - MAX_LINES
  const longest = running.reduce((max, a) => Math.max(max, now - a.startedAt), 0)
  await $.hud.put({
    id: 'agents',
    title: '에이전트',
    badge: running.length ? `${running.length}개 도는 중` : '끝남',
    lines: [...lines, ...(more > 0 ? [[{ text: `+ ${more}개 더`, tone: 'dim' as const }]] : [])],
    compact: [{
      key: 'count', label: '에이전트',
      value: [{ text: `${running.length}/${shown.length}`, tone: 'strong' }, { text: running.length ? ` · ${clockText(longest)}` : ' · 끝남', tone: 'dim' }],
    }],
    brief: running.length ? [{ text: `에이전트 ${running.length}`, tone: 'dim' }] : [],
  })
}

async function change($: EngineInterface, fn: (l: AgentList) => AgentList) {
  await update($, list, fn)
  await publish($)
}

const patch = (id: string, p: Partial<AgentEntry>) => (l: AgentList) => l.map(a => (a.id === id ? { ...a, ...p } : a))

export const register: Register = on => {
  // 에이전트를 띄울 때: 엔진이 띄운 뒤 받은 id 로 적는다. 띄우는 일 자체는 건드리지 않는다
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    try {
      if (r.agentId) {
        const entry: AgentEntry = { id: r.agentId, name: e.description || e.subagentType, kind: e.subagentType, doing: '시작하는 중', startedAt: await $.clock.now(), status: 'running' }
        await change($, l => [...l.filter(a => a.id !== entry.id), entry])
      }
    } catch (err) {
      $.ui.log(`cozy-hud-agents: 에이전트를 적지 못했어요 — ${String(err)}`, { to: 'debug' })
    }
    return r
  })

  // 다시 일어난 에이전트(팀원 등)
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined && (await read($, list)).some(a => a.id === e.agentId)) {
      await change($, patch(e.agentId, { status: 'running', endedAt: undefined })).catch(() => undefined)
    }
    return next(e)
  })

  // 에이전트가 쓰는 도구로 지금 하는 일을 적는다
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined && (await read($, list)).some(a => a.id === e.agentId)) {
      await change($, patch(e.agentId, { doing: DOING[e.tool] ?? `${e.tool} 쓰는 중` })).catch(() => undefined)
    }
    return next(e)
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined && (await read($, list)).some(a => a.id === e.agentId)) {
      const status: AgentStatus = e.isAborted ? 'stopped' : 'done'
      await change($, patch(e.agentId, { status, endedAt: await $.clock.now() })).catch(() => undefined)
    }
    return next(e)
  })
}
