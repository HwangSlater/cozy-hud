// 「오늘」 기록: 끝낸 답변 수, 고친 파일 수, 일한 시간, 쓰다듬은 횟수, 이어서 쓴 날. 날이 바뀌면 새로 센다.
// 설정에서 켰을 때만 카드로 보이고, 세는 것은 늘 한다($.store 에 남아 세션이 바뀌어도 이어짐).
import { atom, update } from 'claude-code'

import type { HudCard } from '../types'
import type { $ } from './state'

const STORE_KEY = 'today'
/** 같은 파일을 두 번 세지 않으려고 기억하는 경로 수의 한도(넘으면 그 뒤로는 수만 셈) */
const MAX_FILES = 500
const CARD_ID = 'today'
const MINUTE = 60_000
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })

export type Today = {
  /** 이 기록의 날(로컬 시각 YYYY-MM-DD) */
  date: string
  answers: number
  workMs: number
  files: readonly string[]
  fileCount: number
  pets: number
  /** 이어서 쓴 날 수(오늘 포함) */
  streak: number
}

const EMPTY = (date: string, streak: number): Today => ({ date, answers: 0, workMs: 0, files: [], fileCount: 0, pets: 0, streak })

/** 로컬 시각의 날짜 「2026-11-04」 */
export function dayOf(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 저장된 기록을 오늘에 맞춘다: 날이 바뀌었으면 새로 시작하고, 어제였으면 이어서 쓴 날을 하나 늘린다 */
export function rollOver(saved: Today | undefined, now: number): Today {
  const today = dayOf(now)
  if (!saved) return EMPTY(today, 1)
  if (saved.date === today) return saved
  const yesterday = dayOf(now - 24 * 60 * MINUTE)
  return EMPTY(today, saved.date === yesterday ? saved.streak + 1 : 1)
}

/** 「2시간 10분」, 「48분」 */
export function workText(ms: number) {
  const m = Math.floor(ms / MINUTE)
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

const mem = { today: null as Today | null }

async function load($: $) {
  const now = await $.clock.now()
  const saved = (await $.store.get(STORE_KEY).catch(() => undefined)) as Today | undefined
  mem.today = rollOver(mem.today ?? saved, now)
  return mem.today
}

/** 카드를 그린다(켰을 때) 또는 내린다(껐을 때) */
export async function showToday($: $, isOn: boolean) {
  if (!isOn) {
    await update($, cards, all => Object.fromEntries(Object.entries(all).filter(([id]) => id !== CARD_ID)))
    return
  }
  const t = await load($)
  const card: HudCard = {
    id: CARD_ID,
    title: '오늘',
    badge: `답변 ${t.answers}`,
    lines: [
      [{ text: '답변 ' }, { text: String(t.answers), tone: 'strong' }, { text: ' · 고친 파일 ' }, { text: String(t.fileCount), tone: 'strong' }, { text: ' · 일한 시간 ' }, { text: workText(t.workMs), tone: 'strong' }],
      [{ text: `쓰다듬기 ${t.pets} · 이어서 쓴 날 ${t.streak}일째`, tone: 'dim' }],
    ],
    compact: [{ key: 'today', label: '오늘', value: [{ text: `답변 ${t.answers}`, tone: 'strong' }, { text: ` · ${workText(t.workMs)}`, tone: 'dim' }] }],
    brief: [{ text: `오늘 ${t.answers}`, tone: 'dim' }],
  }
  await update($, cards, all => ({ ...all, [CARD_ID]: card }))
}

/** 기록을 바꾸고 저장한다. 카드가 켜져 있으면 다시 그린다 */
export async function countToday($: $, isOn: boolean, change: (t: Today) => Today) {
  const next = change(await load($))
  mem.today = next
  await $.store.set(STORE_KEY, next)
  if (isOn) await showToday($, true)
}

/** 고친 파일 하나 더(같은 파일은 한 번만) */
export function addFile(t: Today, path: string): Today {
  if (t.files.includes(path)) return t
  return { ...t, fileCount: t.fileCount + 1, files: t.files.length < MAX_FILES ? [...t.files, path] : t.files }
}
