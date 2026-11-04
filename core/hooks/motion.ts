// 캐릭터 움직임. 타이머마다 엔진에 묻지 않도록 필요한 값은 mem 에 같이 들고 있고,
// 같은 모습(자세)은 한 번만 계산해 둔다. 자리마다 지난번과 같은 자세면 아무 일도 하지 않는다.
import type { HudCharacter, HudMood, HudPaneSize, HudSettings } from '../types'
import { colorOf, frameRows, rasterCells, toCells, type Cell } from './look'
import { PANE, SETTINGS_PANE, mem, type $ } from './state'

/** 속도별 프레임 간격(ms). 멈춤이면 타이머를 아예 두지 않는다 */
const FRAME_MS: Record<HudSettings['motion']['speed'], number> = { fast: 125, normal: 250, slow: 500, off: 0 }
/** 이만큼 깜빡임 프레임마다 한 번(frameRows 와 같아야 함) */
const BLINK_EVERY = 20
/** 계산해 둔 자세가 이보다 많아지면 비운다(캐릭터를 여러 번 바꿨을 때) */
const CACHE_LIMIT = 300

export type PetArt = { cells: Cell[][]; encoded: string }

const art = new Map<string, PetArt>()
/** 자리(requestId) → 마지막으로 끼운 자세 */
const shown = new Map<string, string>()
/** 칸을 끼우다 거절된 자리(보이지 않음). 다시 그려질 때 풀린다 */
const hidden = new Set<string>()
let timer: { cancel: () => void } | null = null
let timerMs = 0

/** 그림이 실제로 달라지는 것만 담은 자세 이름. 같은 이름이면 같은 그림 */
function poseOf(mood: HudMood, frame: number): string {
  if (mood === 'sleep') return 'sleep'
  const blink = frame % BLINK_EVERY === 0 ? 'b' : ''
  if (mood === 'work' || mood === 'happy') return `${mood}${frame % 2}${blink}`
  if (mood === 'sweat') return `sweat${frame % 3}${frame % 2}${blink}`
  return `idle${blink}`
}

function currentCharacter(): HudCharacter | null {
  const id = mem.settings.character
  return id === 'none' ? null : mem.characters[id] ?? null
}

/** 지금 고른 캐릭터를 그 크기·지금 자세로. 캐릭터가 없거나 숨기기(none)면 null */
export function petArt(size: HudPaneSize): PetArt | null {
  const ch = currentCharacter()
  if (!ch || size === 'none') return null
  const sweat = (mem.themes[mem.settings.theme] ?? mem.themes.auto)?.sweat ?? 'claude'
  const key = `${ch.id}|${size}|${sweat}|${poseOf(mem.mood, mem.frame)}`
  let hit = art.get(key)
  if (!hit) {
    if (art.size >= CACHE_LIMIT) art.clear()
    const cells = toCells(frameRows(ch, size, mem.mood, mem.frame), colorOf(ch, sweat))
    hit = { cells, encoded: rasterCells(cells) }
    art.set(key, hit)
  }
  return hit
}

/** 캐릭터 그림이 바뀌었을 때(팩이 새로 보냄) 계산해 둔 것을 버린다 */
export function forgetArt() {
  art.clear()
  shown.clear()
}

/** 자리가 새로 그려졌다: 그 그림이 지금 자세이고, 보이는 자리다 */
export function drawnAt(site: string, encoded: string) {
  shown.set(site, encoded)
  hidden.delete(site)
}

export function forgetSite(site: string) {
  shown.delete(site)
}

async function step($: $) {
  mem.frame++
  const s = mem.settings
  const sites: [string | null, HudPaneSize][] = [
    [s.layout === 'band' ? null : PANE, s.size.pane],
    [s.layout === 'pane' ? null : mem.bandSite, s.size.band],
    [mem.isSettingsShown ? SETTINGS_PANE : null, s.size.pane],
  ]
  for (const [site, size] of sites) {
    if (!site || hidden.has(site)) continue
    const pet = petArt(size)
    if (!pet || shown.get(site) === pet.encoded) continue
    const r = await $.ui.blit({ requestId: site, key: 'pet', cells: pet.encoded }).catch(() => ({ deny: 'error' }))
    if ('deny' in r && r.deny !== undefined) hidden.add(site)
    else shown.set(site, pet.encoded)
  }
}

/** 설정·기분에 맞춰 타이머를 켜고 끈다. 잠들었거나 멈춤이면 타이머가 없다 */
export function syncTimer($: $) {
  const ms = mem.mood === 'sleep' ? 0 : FRAME_MS[mem.settings.motion.speed]
  if (ms === timerMs && (ms === 0) === (timer === null)) return
  timer?.cancel()
  timer = null
  timerMs = ms
  if (ms > 0) timer = $.clock.every(ms, () => void step($))
}
