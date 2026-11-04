// 체크리스트 부품: Claude의 할 일 도구나 마크다운 파일을 따라가며 카드로 보낸다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CardOptions, ChecklistItem, ChecklistStatus } from '../types'

/** 패널에 보일 최대 항목 수(설정 패널에서 고름). 기본값 */
const LINES_DEFAULT = '8'
/** 파일을 다시 확인하는 간격 */
const POLL_MS = 3000
/** 파일 칸을 비웠을 때 먼저 찾아보는 세션 체크리스트 파일(있으면 그것을, 없으면 할 일 도구를 따라감) */
const AUTO_TEMPLATE = '{home}/.claude/checklists/{session}.md'
/** 파일을 못 찾았을 때 mtime 자리에 두는 표시 */
const MISSING = -2
const items = atom({ plugin: 'cozy-hud-checklist', key: 'items' } as const, [] as readonly ChecklistItem[], { shape: 'items-1' })
const options = atom({ plugin: 'cozy-hud-checklist', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })

/** template: 사용자가 적은 경로({home}·{session} 그대로), path: 실제 경로, isAuto: 칸을 비워 자동으로 찾는 중 */
const mem = { template: '', path: '', mtime: -1, isPolling: false, isAuto: false }

/** 파일을 따라가는지: 경로가 있고, 자동으로 찾는 중이면 파일을 찾았을 때만(못 찾으면 할 일 도구를 따라간다) */
export const followsFile = (s: { path: string; isAuto: boolean; mtime: number }) => s.path !== '' && !(s.isAuto && s.mtime < 0)
const isFollowingFile = () => followsFile(mem)

function optionsFor(fileDefault: string) {
  return [
    { key: 'file', label: '체크리스트 파일', kind: 'text' as const, value: fileDefault, placeholder: '비우면 자동(세션 체크리스트 파일, 없으면 할 일 도구) · {home} {session} 사용 가능' },
    {
      key: 'lines', label: '보일 항목 수', kind: 'choice' as const, value: LINES_DEFAULT, forms: ['large' as const, 'medium' as const],
      choices: [{ value: '5', label: '5개' }, { value: '8', label: '8개' }, { value: '12', label: '12개', forms: ['large' as const] }],
    },
  ]
}

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
  const maxLines = Number((await read($, options)).lines ?? LINES_DEFAULT)
  // 비어 있어도 카드는 낸다(설정 패널에서 파일을 고를 수 있게)
  if (list.length === 0) {
    await $.hud.put({
      id: 'checklist', title: '할 일', badge: '0',
      lines: [[{ text: isFollowingFile() ? '파일에 체크리스트(- [ ] 할 일)가 없어요' : '아직 할 일이 없어요', tone: 'dim' }]],
      compact: [{ key: 'progress', label: '할 일', value: [{ text: '없음', tone: 'dim' }] }],
      options: optionsFor(mem.template),
    })
    return
  }
  const done = list.filter(i => i.status === 'completed').length
  const open = list.filter(i => i.status !== 'completed')
  // 끝난 것은 최근 것만 남기고 남은 일을 먼저 보이게
  const shown = [...list.filter(i => i.status === 'completed').slice(-2), ...open].slice(0, maxLines)
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
    compact: [{
      key: 'progress', label: '할 일',
      value: [{ text: `${done}/${list.length}`, tone: 'strong' }, ...(current ? [{ text: ` ${current.text}`, tone: 'text' as const }] : [])],
    }],
    options: optionsFor(mem.template),
  })
}

async function pollFile($: EngineInterface) {
  if (!mem.path) return
  const stat = await $.fs.stat(mem.path).catch(() => null)
  if (!stat) {
    // 자동으로 찾는 파일은 아직 없을 수 있다(세션 중에 생기면 그때부터 따라감). 할 일 도구 목록은 그대로 둔다
    if (mem.isAuto) {
      mem.mtime = MISSING
      return
    }
    // 사람이 적은 경로가 틀렸거나 파일이 없으면 카드에 알린다(한 번만)
    if (mem.mtime !== MISSING) {
      mem.mtime = MISSING
      await $.hud.put({ id: 'checklist', title: '할 일', badge: '!', lines: [[{ text: `파일을 찾을 수 없어요: ${mem.path}`, tone: 'warn' }]], options: optionsFor(mem.template) })
    }
    return
  }
  if (stat.mtimeMs === mem.mtime) return
  mem.mtime = stat.mtimeMs
  await replace($, parseMarkdown(await $.fs.read(mem.path)))
}

async function resolvePath($: EngineInterface, template: string): Promise<string> {
  if (!template) return ''
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  return template.replaceAll('{home}', home).replaceAll('{session}', await $.session.id())
}

/** 따라갈 파일을 바꾼다. 비우면 세션 체크리스트 파일을 자동으로 찾고, 없으면 Claude의 할 일 도구를 따라간다 */
async function useFile($: EngineInterface, template: string) {
  mem.template = template
  mem.isAuto = template === ''
  mem.path = await resolvePath($, template || AUTO_TEMPLATE)
  mem.mtime = -1
  if (mem.path && !mem.isPolling) {
    mem.isPolling = true
    $.clock.every(POLL_MS, () => void pollFile($).catch(() => undefined))
  }
  // 앞서 따라가던 목록을 비우고 새로 읽는다(자동인데 파일이 없으면 빈 채로 할 일 도구를 기다림)
  await update($, items, () => [])
  await publish($)
  await pollFile($).catch(() => undefined)
}

export const register: Register = (on, config) => {
  // 플러그인 설정(userConfig)의 파일은 기본값. 설정 패널에서 고른 값이 있으면 그것을 쓴다
  const fileDefault = typeof config.file === 'string' ? config.file : ''

  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    const chosen = (await read($, options)).file
    await useFile($, chosen ?? fileDefault)
    return answer
  })

  on('hud.option', async ($, e, next) => {
    if (e.card !== 'checklist') return next(e)
    const before = await read($, options)
    await update($, options, () => e.values)
    const file = e.values.file ?? fileDefault
    if (file !== (before.file ?? mem.template)) await useFile($, file)
    else await publish($)
    return next(e)
  })

  // 파일을 따라가지 않을 때만 Claude의 할 일 도구를 따라간다
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (!isFollowingFile() && e.agentId === undefined && ran.deny === undefined && !ran.isError) {
      await replace($, e.todos.map((t, i) => ({ id: `t${i}`, text: t.content, status: t.status })))
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (!isFollowingFile() && e.agentId === undefined && ran.deny === undefined && !ran.isError && ran.result) {
      const id = ran.result.task.id
      await replace($, [...(await read($, items)), { id, text: e.subject, status: 'pending' }])
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (!isFollowingFile() && e.agentId === undefined && ran.deny === undefined && !ran.isError) {
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
