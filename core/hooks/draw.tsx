// 카드·캐릭터를 화면 요소로. 색은 모두 테마의 역할(tone)을 거친다.
import type { EngineInterface } from 'claude-code'
import type { HudCard, HudCharacter, HudLine, HudPiece, HudTone } from '../types'
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

/** 한 줄 = 조각마다 Text 하나 */
export function drawLine(el: El, line: HudLine, tones: Tones, key: string) {
  const { Box, Text } = el
  return (
    <Box key={key} flexDirection="row">
      {line.map((piece, i) => {
        const tone = piece.tone ?? 'text'
        const parts = [
          <Text key={`${key}-${i}`} color={tones[tone]} bold={tone === 'strong'} wrap="truncate-end">
            {pieceText(piece)}
          </Text>,
        ]
        if ('gauge' in piece) {
          const rest = piece.width - cellWidth(pieceText(piece))
          parts.push(<Text key={`${key}-${i}r`} color={tones.line}>{'░'.repeat(Math.max(0, rest))}</Text>)
        }
        return parts
      })}
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

export function drawCard(el: El, card: HudCard, width: number, tones: Tones) {
  const { Box } = el
  return (
    <Box key={card.id} flexDirection="column" marginTop={1}>
      {drawRule(el, card, width, tones)}
      {card.lines.map((line, i) => drawLine(el, line, tones, `${card.id}-${i}`))}
    </Box>
  )
}

/** 캐릭터: 터미널은 Raster(칸만 바꿔 끼워 움직임), 다른 화면은 글자 칸 */
export function drawPet(el: El, isTerminal: boolean, cells: readonly (readonly Cell[])[], encoded: string) {
  const { Box, Text } = el
  const columns = cells[0]?.length ?? 0
  if (isTerminal && 'Raster' in el) {
    const { Raster } = el
    return <Raster key="pet" columns={columns} rows={cells.length} cells={encoded} />
  }
  return (
    <Box key="pet" flexDirection="column">
      {cells.map((line, r) => (
        <Box key={`pet-${r}`} flexDirection="row">
          {line.map((cell, x) => (
            <Text key={`pet-${r}-${x}`} color={cell.fg ?? undefined} backgroundColor={cell.bg ?? undefined}>
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
