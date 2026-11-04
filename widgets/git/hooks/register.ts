// git 부품: 지금 브랜치, 바뀐 파일, 올리지 않은 커밋을 카드로 보낸다. 세션 시작과 답변이 끝날 때마다 다시 읽는다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CardOptions } from '../types'

/** 바뀐 파일을 몇 개까지 줄로 보일지(설정 패널에서 고름). 기본값과 고를 수 있는 값 */
const FILES_DEFAULT = '3'
const FILE_CHOICES = ['0', '3', '6']
/** git 이 늦게 답하면 기다리지 않는다 */
const GIT_TIMEOUT_MS = 5000
const options = atom({ plugin: 'cozy-hud-git', key: 'options' } as const, {} as CardOptions, { shape: 'options-1' })

export type GitFile = { code: string; path: string }
export type GitStatus = { branch: string; ahead: number; behind: number; files: readonly GitFile[] }

/**
 * `git status --porcelain=v1 -b` 를 읽는다.
 * 첫 줄 「## master...origin/main [ahead 2, behind 1]」, 나머지는 「XY 경로」
 */
export function parseStatus(out: string): GitStatus {
  const lines = out.split(/\r?\n/).filter(Boolean)
  const head = lines[0]?.startsWith('## ') ? lines[0].slice(3) : ''
  const branch = head.startsWith('No commits yet on ') ? head.slice('No commits yet on '.length)
    : head.split('...')[0]?.split(' ')[0] ?? ''
  const num = (word: string) => Number(new RegExp(`${word} (\\d+)`).exec(head)?.[1] ?? 0)
  const files = lines.slice(head ? 1 : 0).map(l => ({ code: l.slice(0, 2).trim() || '?', path: l.slice(3).replace(/^"|"$/g, '') }))
  return { branch: branch === 'HEAD' ? '(분리된 HEAD)' : branch, ahead: num('ahead'), behind: num('behind'), files }
}

/** 바뀐 종류 → 표시 글자와 색: 고침 M(경고), 새 파일 A·?(초록), 지움 D(위험) */
function markOf(code: string): { text: string; tone: 'warn' | 'ok' | 'err' | 'dim' } {
  if (code.includes('D')) return { text: 'D', tone: 'err' }
  if (code === '??' || code === '?' || code.includes('A')) return { text: 'A', tone: 'ok' }
  if (code.includes('M') || code.includes('R')) return { text: 'M', tone: 'warn' }
  return { text: code.slice(0, 1), tone: 'dim' }
}

async function publish($: EngineInterface) {
  const run = await $.process.run(['git', 'status', '--porcelain=v1', '-b'], { timeoutMs: GIT_TIMEOUT_MS }).catch(() => null)
  // git 저장소가 아니거나 git 이 없으면 카드를 내지 않는다
  if (!run || run.exitCode !== 0) {
    await $.hud.drop({ id: 'git' })
    return
  }
  const s = parseStatus(run.stdout)
  const maxFiles = Number((await read($, options)).files ?? FILES_DEFAULT)
  const summary = [
    { text: '바뀐 파일 ' }, { text: String(s.files.length), tone: 'strong' as const },
    { text: ' · 올리지 않은 커밋 ' }, { text: String(s.ahead), tone: 'strong' as const },
    ...(s.behind ? [{ text: ' · 받을 커밋 ' }, { text: String(s.behind), tone: 'warn' as const }] : []),
  ]
  const fileLines = s.files.slice(0, maxFiles).map(f => [{ text: `${markOf(f.code).text} `, tone: markOf(f.code).tone }, { text: f.path }])
  const more = s.files.length - Math.min(maxFiles, s.files.length)
  const short = `${s.files.length ? ` · ${s.files.length} 바뀜` : ' · 깨끗함'}${s.ahead ? ` · ↑${s.ahead}` : ''}${s.behind ? ` · ↓${s.behind}` : ''}`
  await $.hud.put({
    id: 'git',
    title: 'git',
    badge: s.branch,
    lines: [
      s.files.length || s.ahead || s.behind ? summary : [{ text: '바뀐 것이 없어요', tone: 'dim' }],
      ...fileLines,
      ...(more > 0 && maxFiles > 0 ? [[{ text: `+ ${more}개 더`, tone: 'dim' as const }]] : []),
    ],
    compact: [{ key: 'branch', label: 'git', value: [{ text: s.branch, tone: 'strong' }, { text: short, tone: 'dim' }] }],
    brief: [{ text: `${s.branch}${s.files.length ? ` ✎${s.files.length}` : ''}`, tone: 'dim' }],
    options: [{
      key: 'files', label: '바뀐 파일 줄', kind: 'choice', value: FILES_DEFAULT, forms: ['large', 'medium'],
      choices: FILE_CHOICES.map(v => ({ value: v, label: v === '0' ? '안 보이기' : `${v}개까지`, ...(v === '6' ? { forms: ['large' as const] } : {}) })),
    }],
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const answer = await next(e)
    await publish($).catch(() => undefined)
    return answer
  })

  on('hud.option', async ($, e, next) => {
    if (e.card === 'git') {
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
