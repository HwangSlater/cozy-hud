// 캐릭터 픽셀 → 터미널 칸. 한 칸 = 위아래 픽셀 두 개(▀ 글자색 = 위, 배경색 = 아래).
import type { HudCharacter, HudMood, HudSize, HudSprite } from '../types'

/** 투명 칸: 터미널 기본색 */
const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄
const SPACE = 0x20
/** 땀방울은 캐릭터 색과 상관없이 같은 글자를 쓴다 */
const SWEAT = 'B'

/** 고른 크기의 그림. 그 크기가 없으면 기본(보통) 그림 */
export function spriteOf(ch: HudCharacter, size: HudSize): HudSprite {
  return (size === 'medium' ? undefined : ch.sizes?.[size]) ?? ch
}

/** 기분과 프레임 번호에 따라 이번에 그릴 픽셀 줄 */
export function frameRows(ch: HudCharacter, size: HudSize, mood: HudMood, frame: number): string[] {
  const sp = spriteOf(ch, size)
  let rows = [...sp.rows]
  const isShut = mood === 'sleep' || frame % 20 === 0
  if (mood === 'work' && frame % 2 === 1) {
    for (const [i, row] of Object.entries(sp.alt)) rows[Number(i)] = row
  }
  // 눈 감기: 눈동자(K)와 반짝이(H)를 몸 색으로
  if (isShut) {
    rows = rows.map((row, i) => (sp.eyes.includes(i) ? row.replace(/[KH]/g, ch.body) : row))
  }
  rows = rows.map(row => row + '..')
  const empty = '.'.repeat(rows[0]?.length ?? 0)
  const canvas = mood === 'happy' && frame % 2 === 1 ? [...rows, empty, empty] : [empty, ...rows, empty]
  if (mood === 'sweat') {
    const y = 1 + (frame % 3)
    const line = canvas[y] ?? empty
    canvas[y] = line.slice(0, -1) + SWEAT
  }
  return canvas
}

export type PixelColor = string | null

/** 픽셀 글자 → 색. 모르는 글자는 투명. */
export function colorOf(ch: HudCharacter, sweatColor: string): (px: string) => PixelColor {
  return px => (px === '.' ? null : px === SWEAT ? sweatColor : ch.colors[px] ?? null)
}

/** 한 칸: 글자와 위·아래 색 */
export type Cell = { glyph: string; fg: PixelColor; bg: PixelColor }

export function toCells(rows: readonly string[], color: (px: string) => PixelColor): Cell[][] {
  const out: Cell[][] = []
  for (let r = 0; r < rows.length; r += 2) {
    const top = rows[r] ?? ''
    const bottom = rows[r + 1] ?? ''
    const line: Cell[] = []
    for (let x = 0; x < top.length; x++) {
      const up = color(top[x] ?? '.')
      const down = color(bottom[x] ?? '.')
      if (up && down) line.push({ glyph: '▀', fg: up, bg: down })
      else if (up) line.push({ glyph: '▀', fg: up, bg: null })
      else if (down) line.push({ glyph: '▄', fg: down, bg: null })
      else line.push({ glyph: ' ', fg: null, bg: null })
    }
    out.push(line)
  }
  return out
}

const hexToInt = (hex: PixelColor) => (hex ? Number.parseInt(hex.slice(1), 16) : DEFAULT)
const glyphCode = (glyph: string) => (glyph === '▀' ? UPPER : glyph === '▄' ? LOWER : SPACE)

/** Raster 의 cells: 칸마다 [글자, 글자색, 배경색] u32 세 개를 base64 로 */
export function rasterCells(cells: readonly (readonly Cell[])[]): string {
  const words: number[] = []
  for (const line of cells) {
    for (const cell of line) words.push(glyphCode(cell.glyph), hexToInt(cell.fg), hexToInt(cell.bg))
  }
  const bytes = new Uint8Array(Uint32Array.from(words).buffer)
  return (bytes as Uint8Array & { toBase64: () => string }).toBase64()
}
