// 카드·캐릭터를 화면 요소로. 색은 모두 테마의 역할(tone)을 거친다.
import type { EngineInterface } from 'claude-code'
import type { HudCard, HudCharacter, HudForm, HudLine, HudPiece, HudRow, HudTone } from '../types'
import type { Cell } from './look'

type El = ReturnType<EngineInterface['ui']['resolve']>
export type Tones = Record<HudTone | 'line', string>

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/
/** 터미널 칸 수(한글·한자는 2칸) */
export const cellWidth = (text: string) => [...text].reduce((sum, ch) => sum + (WIDE.test(ch) ? 2 : 1), 0)

const SPARK = '▁▂▃▄▅▆▇█'

function pieceText(piece: HudPiece): string {
  if ('text' in piece) return piece.text
  if ('gauge' in piece) {
    const filled = Math.round(Math.max(0, Math.min(1, piece.gauge)) * piece.width)
    return '█'.repeat(filled)
  }
  const max = Math.max(...piece.spark, 1)
  return piece.spark.map(v => SPARK[Math.round((v / max) * 7)] ?? ' ').join('')
}

/** 게이지·막대그래프가 들어갈 최소 칸(이보다 좁아도 이만큼은 그린다) */
const MIN_FLEX_COLUMNS = 4

/**
 * 줄을 칸 수에 맞춘다: 글자는 그대로 두고, 게이지는 폭을 줄이고 막대그래프는 최근 것만 남긴다.
 * 좁은 패널에서 게이지가 다음 줄로 넘치거나 막대그래프가 잘리던 것을 막는다
 */
export function fitLine(line: HudLine, columns: number): HudLine {
  const fixed = line.reduce((sum, p) => sum + ('text' in p ? cellWidth(p.text) : 0), 0)
  const flex = line.filter(p => !('text' in p)).length
  if (flex === 0) return line
  const room = Math.max(MIN_FLEX_COLUMNS, Math.floor((columns - fixed) / flex))
  return line.map(p => ('gauge' in p ? { ...p, width: Math.min(p.width, room) } : 'spark' in p ? { ...p, spark: p.spark.slice(-room) } : p))
}

/** 한 줄 = 조각마다 Text 하나. columns 를 주면 그 칸에 맞춰 게이지·막대그래프를 줄인다 */
export function drawLine(el: El, raw: HudLine, tones: Tones, key: string, columns?: number) {
  const { Box, Text } = el
  const line = columns === undefined ? raw : fitLine(raw, columns)
  return (
    <Box key={key} flexDirection="row">
      <Text wrap="truncate-end">
        {line.map((piece, i) => {
          const tone = piece.tone ?? 'text'
          const parts = [
            <Text key={`${key}-${i}`} color={tones[tone]} bold={tone === 'strong'}>{pieceText(piece)}</Text>,
          ]
          if ('gauge' in piece) {
            const rest = piece.width - cellWidth(pieceText(piece))
            parts.push(<Text key={`${key}-${i}r`} color={tones.line}>{'░'.repeat(Math.max(0, rest))}</Text>)
          }
          return parts
        })}
      </Text>
    </Box>
  )
}

/** 「제목 ───── 3/5」 */
export function drawRule(el: El, card: HudCard, width: number, tones: Tones) {
  const { Box, Text } = el
  const badge = card.badge ?? ''
  const fill = Math.max(1, width - cellWidth(card.title) - cellWidth(badge) - 2)
  return (
    <Box key={`${card.id}-rule`} flexDirection="row">
      <Text bold color={tones.strong}>{card.title} </Text>
      <Text color={tones.line}>{'─'.repeat(fill)}</Text>
      {badge ? <Text color={tones.dim}> {badge}</Text> : null}
    </Box>
  )
}

/** 카드 하나: 제목 줄 + 줄들. 「크게」 모양은 세부 줄까지 */
export function drawCard(el: El, card: HudCard, width: number, tones: Tones, form: HudForm = 'medium') {
  const { Box } = el
  const lines = form === 'large' ? [...card.lines, ...(card.detail ?? [])] : card.lines
  return (
    <Box key={card.id} flexDirection="column" marginTop={1}>
      {drawRule(el, card, width, tones)}
      {lines.map((line, i) => drawLine(el, line, tones, `${card.id}-${i}`, width))}
    </Box>
  )
}

/** 「작게」 모양에서 카드가 내는 줄들. compact 가 없으면 제목 · 한 줄 요약 */
export const rowsOf = (card: HudCard): readonly HudRow[] =>
  card.compact ?? (card.brief?.length ? [{ key: 'brief', label: card.title, value: card.brief }] : [])

/** 이름과 값 사이 칸 */
const ROW_GAP = 2

/** 「작게」 모양: 가로줄 아래에 카드마다 「이름 · 값」 줄. 이름 칸을 가장 긴 이름에 맞춰 값이 세로로 선다 */
export function drawRows(el: El, cards: readonly HudCard[], hiddenRows: readonly string[], width: number, tones: Tones) {
  const { Box, Text } = el
  const rows = cards.flatMap(card => rowsOf(card).filter(r => !hiddenRows.includes(`${card.id}.${r.key}`)).map(r => ({ ...r, id: `${card.id}.${r.key}` })))
  if (rows.length === 0) return null
  const labelColumns = Math.max(...rows.map(r => cellWidth(r.label))) + ROW_GAP
  return (
    <Box key="rows" flexDirection="column">
      <Text color={tones.line}>{'─'.repeat(Math.max(1, width))}</Text>
      {rows.map(r => (
        <Box key={`row-${r.id}`} flexDirection="row">
          <Text color={tones.dim}>{r.label + ' '.repeat(labelColumns - cellWidth(r.label))}</Text>
          {drawLine(el, r.value, tones, `row-${r.id}-v`, width - labelColumns)}
        </Box>
      ))}
    </Box>
  )
}

/** 캐릭터: 터미널은 Raster(칸만 바꿔 끼워 움직임), 다른 화면은 글자 칸 */
export function drawPet(el: El, isTerminal: boolean, cells: readonly (readonly Cell[])[], encoded: string, key = 'pet') {
  const { Box, Text } = el
  const columns = cells[0]?.length ?? 0
  if (isTerminal && 'Raster' in el) {
    const { Raster } = el
    return <Raster key={key} columns={columns} rows={cells.length} cells={encoded} />
  }
  return (
    <Box key={key} flexDirection="column">
      {cells.map((line, r) => (
        <Box key={`${key}-${r}`} flexDirection="row">
          {line.map((cell, x) => (
            <Text key={`${key}-${r}-${x}`} color={cell.fg ?? undefined} backgroundColor={cell.bg ?? undefined}>
              {cell.glyph}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/** 카드들의 한 줄 요약을 「 · 」로 이은 줄 */
export function briefLine(cards: readonly HudCard[]): HudLine {
  const out: HudPiece[] = []
  for (const card of cards) {
    if (!card.brief) continue
    if (out.length > 0) out.push({ text: '  ·  ', tone: 'dim' })
    out.push(...card.brief)
  }
  return out
}

export function drawSpeech(el: El, speech: string, tones: Tones, character: HudCharacter | null) {
  const { Box, Text } = el
  if (!speech) return null
  return (
    <Box key="speech" borderStyle="round" borderColor={tones.line} paddingX={1}>
      <Text bold color={character ? tones.strong : tones.accent} wrap="truncate-end">{speech}</Text>
    </Box>
  )
}
