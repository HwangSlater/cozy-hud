// 체크리스트 부품: Claude 의 할 일 도구나 마크다운 파일을 따라가며 카드로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ChecklistItem, ChecklistStatus } from '../types'

/** 패널에 보일 최대 항목 수 */
const MAX_LINES = 8
/** 파일을 다시 확인하는 간격 */
const POLL_MS = 3000
const items = atom({ plugin: 'cozy-hud-checklist', key: 'items' } as const, [] as readonly ChecklistItem[], { shape: 'items-1' })

const mem = { path: '', mtime: -1 }

const MARK: Record<ChecklistStatus, { text: string; tone: 'ok' | 'accent' | 'dim' }> = {
  completed: { text: '✓ ', tone: 'ok' },
  in_progress: { text: '▸ ', tone: 'accent' },
  pending: { text: '○ ', tone: 'dim' },
}

/** 마크다운 체크리스트: 「- [ ] 할 일」, 「- [x] 끝난 일」 */
function parseMarkdown(text: string): ChecklistItem[] {
  const out: ChecklistItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line)
    if (m?.[2]) out.push({ id: `f${out.length}`, text: m[2].trim(), status: m[1] === ' ' ? 'pending' : 'completed' })
  }
  // 파일에는 「진행 중」이 없으니 첫 번째 남은 일을 진행 중으로 본다
  const first = out.find(i => i.status === 'pending')
  return out.map(i => (i === first ? { ...i, status: 'in_progress' as const } : i))
}

/** 목록을 바꾸고, 새로 끝난 항목이 있으면 캐릭터가 기뻐하게 한다 */
async function replace($: EngineInterface, next: readonly ChecklistItem[]) {
  const before = await read($, items)
  const wasDone = new Set(before.filter(i => i.status === 'completed').map(i => i.text))
  const fresh = next.filter(i => i.status === 'completed' && !wasDone.has(i.text))
  await update($, items, () => next)
  await publish($)
  const done = fresh[fresh.length - 1]
  if (done && before.length > 0) await $.hud.say({ kind: 'cheer', text: `「${done.text}」 끝!` })
}

async function publish($: EngineInterface) {
  const list = await read($, items)
  if (list.length === 0) {
    await $.hud.drop({ id: 'checklist' })
    return
  }
  const done = list.filter(i => i.status === 'completed').length
  const open = list.filter(i => i.status !== 'completed')
  // 끝난 것은 최근 것만 남기고 남은 일을 먼저 보이게
  const shown = [...list.filter(i => i.status === 'completed').slice(-2), ...open].slice(0, MAX_LINES)
  const hiddenCount = list.length - shown.length
  const current = list.find(i => i.status === 'in_progress') ?? open[0]
  await $.hud.put({
    id: 'checklist',
    title: '할 일',
    badge: `${done}/${list.length}`,
    lines: [
      ...shown.map(i => [MARK[i.status], { text: i.text, tone: i.status === 'completed' ? ('dim' as const) : i.status === 'in_progress' ? ('strong' as const) : ('text' as const) }]),
      ...(hiddenCount > 0 ? [[{ text: `  …그 밖에 ${hiddenCount}개`, tone: 'dim' as const }]] : []),
    ],
    brief: [{ text: `할 일 ${done}/${list.length}`, tone: 'dim' }, ...(current ? [{ text: ` · ${current.text}`, tone: 'text' as const }] : [])],
  })
}

async function pollFile($: EngineInterface) {
  if (!mem.path) return
  const stat = await $.fs.stat(mem.path).catch(() => null)
  if (!stat || stat.mtimeMs === mem.mtime) return
  mem.mtime = stat.mtimeMs
  await replace($, parseMarkdown(await $.fs.read(mem.path)))
}

async function resolvePath($: EngineInterface, template: string): Promise<string> {
  if (!template) return ''
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  return template.replaceAll('{home}', home).replaceAll('{session}', await $.session.id())
}

export const register: Register = (on, options) => {
  const template = typeof options.file === 'string' ? options.file : ''

  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    mem.path = await resolvePath($, template)
    mem.mtime = -1
    if (mem.path) {
      await pollFile($).catch(() => undefined)
      $.clock.every(POLL_MS, () => void pollFile($).catch(() => undefined))
    } else {
      await publish($)
    }
    return answer
  })

  // 파일을 쓰지 않을 때만 Claude 의 할 일 도구를 따라간다
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (!mem.path && e.agentId === undefined && ran.deny === undefined && !ran.isError) {
      await replace($, e.todos.map((t, i) => ({ id: `t${i}`, text: t.content, status: t.status })))
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (!mem.path && e.agentId === undefined && ran.deny === undefined && !ran.isError && ran.result) {
      const id = ran.result.task.id
      await replace($, [...(await read($, items)), { id, text: e.subject, status: 'pending' }])
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (!mem.path && e.agentId === undefined && ran.deny === undefined && !ran.isError) {
      const list = await read($, items)
      const status = e.status
      const changed = status === 'deleted'
        ? list.filter(i => i.id !== e.taskId)
        : list.map(i => (i.id === e.taskId ? { ...i, text: e.subject ?? i.text, status: status ?? i.status } : i))
      await replace($, changed)
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))
}
