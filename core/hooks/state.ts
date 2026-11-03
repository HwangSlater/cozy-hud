// 코어의 화면 값(atom)과 설정 저장. 본체(register)·설정 패널(panel)·움직임(motion)이 같이 쓴다.
// atom 은 화면을 다시 그리게 하는 진짜 값이고, mem 의 settings·characters·mood 는
// 타이머가 엔진에 묻지 않고 읽도록 같이 들고 있는 사본이다(값을 바꾸는 곳은 이 파일의 함수뿐).
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudMood, HudSettings } from '../types'
import { forgetArt, syncTimer } from './motion'
import { DEFAULTS, optionValues, type ThemeSpec } from './settings'

export type $ = EngineInterface

export const PANE = 'cozy-hud'
export const SETTINGS_PANE = 'cozy-hud-settings'
const STORE_KEY = 'settings'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(register·panel 과 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-2' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })

/** 모듈 상태(다시 불러오면 처음부터). 화면에 남겨야 하는 값은 atom 에 둔다 */
export const mem = {
  themes: {} as Record<string, ThemeSpec>,
  settings: DEFAULTS,
  characters: {} as Readonly<Record<string, HudCharacter>>,
  mood: 'idle' as HudMood,
  // 0 번째 프레임은 눈 감는 프레임이라 1 부터
  frame: 1,
  isWorking: false,
  bandSite: null as string | null,
  /** 부품에 마지막으로 알린 카드 설정 값(같은 값을 다시 보내지 않으려고) */
  sentOptions: new Map<string, string>(),
  sleepTimer: null as { cancel: () => void } | null,
  reactTimer: null as { cancel: () => void } | null,
  /** 「처음 설정으로」 바로 전 설정(되돌리기용) */
  undo: null as HudSettings | null,
  /** 설정 패널이 그려져 있는지(캐릭터 미리보기를 움직일지) */
  isSettingsShown: false,
}

/** 세션 시작·다시 불러오기: atom 에 남은 값으로 사본을 채운다 */
export async function syncFromState($: $) {
  mem.settings = await read($, settings)
  mem.characters = await read($, characters)
  mem.mood = (await read($, live)).mood
  forgetArt()
  syncTimer($)
}

export async function setMood($: $, mood: HudMood, speech: string) {
  mem.mood = mood
  await update($, live, () => ({ mood, speech, since: Date.now() }))
  syncTimer($)
}

/** 세션 시작·다시 불러오기: 목록을 코어 캐릭터만으로 새로 시작한다(뺀 캐릭터·예전 그림이 남지 않게). 팩은 hud.ready 를 듣고 다시 보낸다 */
export async function resetCharacters($: $, list: readonly HudCharacter[]) {
  const next = Object.fromEntries(list.map(ch => [ch.id, ch]))
  await update($, characters, () => next)
  mem.characters = next
  forgetArt()
}

export async function addCharacters($: $, list: readonly HudCharacter[]) {
  const next = { ...(await read($, characters)), ...Object.fromEntries(list.map(ch => [ch.id, ch])) }
  await update($, characters, () => next)
  mem.characters = next
  forgetArt()
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
  mem.settings = next
  await update($, settings, () => next)
  await $.store.set(STORE_KEY, next)
  forgetArt()
  syncTimer($)
  for (const card of Object.values(await read($, cards))) await sendOptions($, card, next)
  // 배치가 바뀔 때만 HUD 패널을 열고 닫는다(설정 패널을 보는 중에 앞을 가로채지 않게)
  if (next.layout === before.layout) return
  if (next.layout === 'band') await $.ui.close({ id: PANE })
  else await $.ui.open({ id: PANE, title: 'HUD' })
}

export function loadStored($: $) {
  return $.store.get(STORE_KEY)
}
