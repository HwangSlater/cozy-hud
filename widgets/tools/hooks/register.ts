// 도구 기록 부품: Claude가 방금 쓴 도구를 시간순(최근이 위)으로 카드에 보낸다. 실패한 도구는 경고색.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CardOptions, ToolEntry, ToolLog, ToolStatus } from '../types'

/** 보일 줄 수(설정 패널에서 고름). 기본값과 고를 수 있는 값 */
const LINES_DEFAULT = '5'
const LINE_CHOICES = ['3', '5', '8']
/** 기억해 둘 최대 기록 수(가장 많이 보일 때만큼) */
const KEEP = 8
/** 대상(파일·명령)을 이 칸 수까지만 */
const TARGET_MAX = 28
/** 「12초 전」을 다시 그리는 간격 */
const TICK_MS = 15_000
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/** 도구 → 한 일(끝난 뒤) */
const DONE: Readonly<Record<string, string>> = {
  Read: '읽음', Edit: '고침', Write: '씀', NotebookEdit: '고침', MultiEdit: '고침', Bash: '실행', PowerShell: '실행',
  Grep: '찾음', Glob: '찾음', WebFetch: '읽음', WebSearch: '검색', Agent: '맡김', Skill: '스킬',
}
const MARK: Readonly<Record<ToolStatus, { text: string; tone: 'accent' | 'ok' | 'err' }>> = {
  running: { text: '▸ ', tone: 'accent' }, ok: { text: '✓ ', tone: 'ok' }, failed: { text: '✗ ', tone: 'err' },
}

const log = atom({ plugin: 'cozy-hud-tools', key: 'log' } as const, { entries: [], count: 0 } as ToolLog, { shape: 'log-1' })
const options = atom({ plugin: 'cozy-hud-tools', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })
const mem = { isTicking: false, next: 0 }

/** 도구 입력에서 보여 줄 대상: 파일 이름, 명령 앞부분, 찾는 말 */
export function targetOf(input: Readonly<Record<string, unknown>>): string {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = str('file_path') || str('notebook_path')
  const raw = path ? path.split(/[\\/]/).pop() ?? path
    : str('command') ? str('command').split('\n')[0] ?? ''
      : str('pattern') ? `"${str('pattern')}"`
        : str('description') || str('query') || str('url') || str('skill')
  return [...raw].length > TARGET_MAX ? `${[...raw].slice(0, TARGET_MAX - 1).join('')}…` : raw
}

/** 「방금」, 「12초 전」, 「3분 전」, 「1시간 전」 */
export function agoText(ms: number) {
  if (ms < 5 * SECOND) return '방금'
  if (ms < MINUTE) return `${Math.floor(ms / SECOND)}초 전`
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}분 전`
  return `${Math.floor(ms / HOUR)}시간 전`
}

const verbOf = (tool: string) => DONE[tool] ?? tool

async function publish($: EngineInterface) {
  const { entries, count } = await read($, log)
  const now = await $.clock.now()
  const shown = entries.slice(0, Number((await read($, options)).lines ?? LINES_DEFAULT))
  const latest = entries[0]
  await $.hud.put({
    id: 'tools',
    title: '최근 한 일',
    badge: count ? `${count}번` : '',
    lines: shown.length
      ? shown.map(e => [
        { text: MARK[e.status].text, tone: MARK[e.status].tone },
        { text: `${verbOf(e.tool)}  ` },
        { text: e.target, tone: e.status === 'failed' ? 'err' as const : 'strong' as const },
        { text: `  ${agoText(now - e.at)}`, tone: 'dim' as const },
      ])
      : [[{ text: '아직 쓴 도구가 없어요', tone: 'dim' }]],
    compact: [{
      key: 'last', label: '최근',
      value: latest ? [{ text: `${verbOf(latest.tool)} `, tone: 'dim' }, { text: latest.target, tone: latest.status === 'failed' ? 'err' : 'strong' }] : [{ text: '없음', tone: 'dim' }],
    }],
    brief: latest ? [{ text: `${verbOf(latest.tool)} `, tone: 'dim' }, { text: latest.target, tone: latest.status === 'failed' ? 'err' : 'dim' }] : [],
    options: [{
      key: 'lines', label: '보일 줄 수', kind: 'choice', value: LINES_DEFAULT, forms: ['large', 'medium'],
      choices: LINE_CHOICES.map(v => ({ value: v, label: `${v}줄`, ...(v === '8' ? { forms: ['large' as const] } : {}) })),
    }],
  })
  if (entries.length && !mem.isTicking) {
    mem.isTicking = true
    $.clock.every(TICK_MS, () => void publish($).catch(() => undefined))
  }
}

async function record($: EngineInterface, change: (log: ToolLog) => ToolLog) {
  await update($, log, change)
  await publish($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($).catch(() => undefined)
    return answer
  })

  on('hud.option', async ($, e, next) => {
    if (e.card === 'tools') {
      await update($, options, () => e.values)
      await publish($).catch(() => undefined)
    }
    return next(e)
  })

  // 메인 대화의 도구만 적는다(서브에이전트 것은 에이전트 카드가 맡음)
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const id = `t${mem.next++}`
    const entry: ToolEntry = { id, tool: e.tool, target: targetOf(e as unknown as Record<string, unknown>), at: await $.clock.now(), status: 'running' }
    await record($, l => ({ entries: [entry, ...l.entries].slice(0, KEEP), count: l.count + 1 })).catch(() => undefined)
    const ran = await next(e)
    const status: ToolStatus = ran.deny !== undefined || ran.isError ? 'failed' : 'ok'
    await record($, l => ({ ...l, entries: l.entries.map(x => (x.id === id ? { ...x, status } : x)) })).catch(() => undefined)
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))
}
