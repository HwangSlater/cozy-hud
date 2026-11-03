// 코어의 화면 값(atom)과 설정 저장. 본체(register)와 설정 패널(panel)이 같이 쓴다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudSettings, HudSize } from '../types'
import { colorOf, frameRows, toCells } from './look'
import { DEFAULTS, optionValues, type ThemeSpec } from './settings'

export type $ = EngineInterface

export const PANE = 'cozy-hud'
export const SETTINGS_PANE = 'cozy-hud-settings'
const STORE_KEY = 'settings'

const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-2' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })

/** 모듈 상태(다시 불러오면 처음부터). 화면에 남겨야 하는 값은 atom 에 둔다 */
export const mem = {
  themes: {} as Record<string, ThemeSpec>,
  frame: 0,
  tick: 0,
  isWorking: false,
  bandSite: null as string | null,
  lastBlit: new Map<string, string>(),
  /** 부품에 마지막으로 알린 카드 설정 값(같은 값을 다시 보내지 않으려고) */
  sentOptions: new Map<string, string>(),
  sleepTimer: null as { cancel: () => void } | null,
  reactTimer: null as { cancel: () => void } | null,
  /** 「처음 설정으로」 바로 전 설정(되돌리기용) */
  undo: null as HudSettings | null,
  /** 설정 패널이 그려져 있는지(캐릭터 미리보기를 움직일지) */
  isSettingsShown: false,
}

/** 고른 캐릭터를 그 크기로 지금 기분·프레임에 맞춰 칸으로. 캐릭터가 없으면 null */
export async function petCells($: $, size: HudSize) {
  const s = await read($, settings)
  const ch = s.character === 'none' ? null : (await read($, characters))[s.character] ?? null
  if (!ch) return null
  const mood = (await read($, live)).mood
  const sweat = (mem.themes[s.theme] ?? mem.themes.auto)?.sweat ?? 'claude'
  return toCells(frameRows(ch, size, mood, mem.frame), colorOf(ch, sweat))
}

/** 카드 설정 값이 처음 정해졌거나 바뀌었으면 그 부품에 알린다 */
export async function sendOptions($: $, card: HudCard, s: HudSettings) {
  if (!card.options?.length) return
  const values = optionValues(card, s)
  const sig = JSON.stringify(values)
  if (mem.sentOptions.get(card.id) === sig) return
  mem.sentOptions.set(card.id, sig)
  await $.hud.option({ card: card.id, values })
}

/** 설정을 바꾸고 저장한다. 화면은 atom 이 바뀌어 다시 그려진다 */
export async function saveSettings($: $, change: (s: HudSettings) => HudSettings) {
  const before = await read($, settings)
  const next = change(before)
  await update($, settings, () => next)
  await $.store.set(STORE_KEY, next)
  mem.lastBlit.clear()
  for (const card of Object.values(await read($, cards))) await sendOptions($, card, next)
  // 배치가 바뀔 때만 HUD 패널을 열고 닫는다(설정 패널을 보는 중에 앞을 가로채지 않게)
  if (next.layout === before.layout) return
  if (next.layout === 'band') await $.ui.close({ id: PANE })
  else await $.ui.open({ id: PANE, title: 'HUD' })
}

export function loadStored($: $) {
  return $.store.get(STORE_KEY)
}
