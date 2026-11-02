// cozy-hud 코어: $.hud 를 더하고, 부품이 보낸 카드와 캐릭터를 패널·입력창 위 줄에 그린다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudMood, HudSettings } from '../types'
import { briefLine, drawCard, drawLine, drawPet, drawSpeech, type Tones } from './draw'
import { colorOf, frameRows, rasterCells, toCells } from './look'
import { DEFAULTS, arrange, fromStore, runCommand, type ThemeSpec } from './settings'

const PANE = 'cozy-hud'
const STORE_KEY = 'settings'
/** 캐릭터가 움직이는 간격 */
const FRAME_MS = 250
/** 기뻐하거나 걱정하는 표정이 남는 시간 */
const REACT_MS = 2500
/** 이만큼 조용하면 잠든다 */
const SLEEP_MS = 15 * 60 * 1000
/** 컨텍스트가 이만큼 차면 땀 */
const SWEAT_PERCENT = 80

const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-1' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-1' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })

type $ = EngineInterface
const VERB: Record<string, string> = { Read: '읽는 중', Grep: '찾는 중', Glob: '찾는 중', Edit: '고치는 중', Write: '쓰는 중', Bash: '실행하는 중' }

/** 모듈 상태(다시 불러오면 처음부터). 화면에 남겨야 하는 값은 atom 에 둔다 */
const mem = {
  themes: {} as Record<string, ThemeSpec>,
  frame: 0,
  isWorking: false,
  bandSite: null as string | null,
  lastBlit: new Map<string, string>(),
  sleepTimer: null as { cancel: () => void } | null,
  reactTimer: null as { cancel: () => void } | null,
}

async function setMood($: $, mood: HudMood, speech: string) {
  await update($, live, () => ({ mood, speech, since: Date.now() }))
}

async function restMood($: $) {
  const usage = await $.session.usage().catch(() => null)
  const percent = usage?.context.percent ?? 0
  if (percent >= SWEAT_PERCENT) await setMood($, 'sweat', `컨텍스트 ${percent}% — 곧 압축돼요`)
  else await setMood($, mem.isWorking ? 'work' : 'idle', '')
}

function tonesFor(s: HudSettings, ch: HudCharacter | null): Tones {
  const spec = mem.themes[s.theme] ?? mem.themes.auto
  const t = (spec?.tones ?? {}) as Record<string, string>
  const pick = (k: string) => (t[k] === '@character' ? ch?.accent ?? 'claude' : t[k] ?? 'text')
  return { text: pick('text'), dim: pick('dim'), strong: pick('strong'), accent: pick('accent'), ok: pick('ok'), warn: pick('warn'), err: pick('err'), line: pick('line') }
}

async function currentCharacter($: $): Promise<HudCharacter | null> {
  const s = await read($, settings)
  return s.character === 'none' ? null : (await read($, characters))[s.character] ?? null
}

async function petCells($: $) {
  const ch = await currentCharacter($)
  if (!ch) return null
  const s = await read($, settings)
  const mood = (await read($, live)).mood
  const sweat = (mem.themes[s.theme] ?? mem.themes.auto)?.sweat ?? 'claude'
  return toCells(frameRows(ch, mood, mem.frame, 'B'), colorOf(ch, sweat))
}

// 터미널에서는 다시 그리지 않고 캐릭터 칸만 바꿔 끼운다
async function animate($: $) {
  mem.frame++
  const cells = await petCells($)
  if (!cells) return
  const encoded = rasterCells(cells)
  for (const site of [PANE, mem.bandSite]) {
    if (!site || mem.lastBlit.get(site) === encoded) continue
    const r = await $.ui.blit({ requestId: site, key: 'pet', cells: encoded }).catch(() => ({ deny: 'error' }))
    if (!('deny' in r) || r.deny === undefined) mem.lastBlit.set(site, encoded)
  }
}

async function wakeAfterTurn($: $) {
  mem.isWorking = false
  if ((await read($, live)).mood !== 'happy') await restMood($)
  mem.sleepTimer?.cancel()
  mem.sleepTimer = $.clock.after(SLEEP_MS, () => void setMood($, 'sleep', ''))
}

export const register: Register = on => {
  // ── $.hud: 다른 mod 가 부르는 입구. 실제 일은 아래 hud.* 훅이 $ 를 들고 한다 ──
  on('engine.create', async (_$, e, next) => {
    const built = await next(e)
    const ack = async () => ({ isDone: true as const })
    return { ...built, hud: { put: ack, drop: ack, characters: ack, say: ack } }
  })

  on('hud.put', async ($, e, next) => {
    await update($, cards, all => ({ ...all, [e.id]: e }))
    return next(e)
  })
  on('hud.drop', async ($, e, next) => {
    await update($, cards, all => Object.fromEntries(Object.entries(all).filter(([id]) => id !== e.id)))
    return next(e)
  })
  on('hud.characters', async ($, e, next) => {
    await update($, characters, all => ({ ...all, ...Object.fromEntries(e.list.map(ch => [ch.id, ch])) }))
    return next(e)
  })
  on('hud.say', async ($, e, next) => {
    await setMood($, e.kind === 'cheer' ? 'happy' : 'sweat', e.text)
    mem.reactTimer?.cancel()
    mem.reactTimer = $.clock.after(REACT_MS, () => void restMood($))
    return next(e)
  })

  // ── 세션 시작: 고른 값 불러오기 · 명령 · 패널 · 움직임 ──
  on('session.start', async ($, e, next) => {
    mem.themes = JSON.parse(await $.fs.read(`${$.plugin.root}/themes.json`)) as Record<string, ThemeSpec>
    const saved = fromStore(await $.store.get(STORE_KEY))
    await update($, settings, () => saved)
    await $.command.register({ name: 'hud', description: 'cozy-hud 배치·캐릭터·테마 바꾸기', argumentHint: '[layout|character|theme|order|hide|show|reset]' })
    if (saved.layout !== 'band') void $.ui.open({ id: PANE, title: 'HUD' })
    $.clock.every(FRAME_MS, () => void animate($))
    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const s = await read($, settings)
    const { next, text } = runCommand(e.args, s, { themes: mem.themes, characters: await read($, characters), cards: await read($, cards) })
    if (next) {
      await update($, settings, () => next)
      await $.store.set(STORE_KEY, next)
      mem.lastBlit.clear()
    }
    const layout = (next ?? s).layout
    if (layout !== 'band') await $.ui.open({ id: PANE, title: 'HUD' })
    return { text }
  })

  // ── 기분: 일 시작 · 도구 · 일 끝 ──
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    mem.isWorking = true
    mem.sleepTimer?.cancel()
    await setMood($, 'work', '')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (mem.isWorking && e.agentId === undefined && VERB[e.tool]) {
      const input = e as unknown as { file_path?: string; pattern?: string; command?: string }
      const target = input.file_path?.split(/[\\/]/).pop() ?? input.pattern ?? input.command?.slice(0, 24) ?? ''
      const mood = (await read($, live)).mood
      if (mood === 'work') await update($, live, v => ({ ...v, speech: `${target} ${VERB[e.tool]}`.trim() }))
    }
    return next(e)
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await wakeAfterTurn($)
    return next(e)
  })

  // ── 그리기 ──
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const s = await read($, settings)
    const ch = s.character === 'none' ? null : (await read($, characters))[s.character] ?? null
    const tones = tonesFor(s, ch)
    const shown = arrange(await read($, cards), s)
    const v = await read($, live)
    const width = e.props.bodyColumns
    const cells = await petCells($)
    mem.lastBlit.delete(PANE)
    return (
      <Box flexDirection="column">
        {cells ? (
          <Box flexDirection="row">
            {drawPet(el, e.surface === 'terminal', cells, rasterCells(cells))}
            <Box flexDirection="column" marginLeft={2} flexShrink={1}>
              {drawSpeech(el, v.speech, tones, ch)}
            </Box>
          </Box>
        ) : v.speech ? <Text color={tones.accent}>{v.speech}</Text> : null}
        {shown.length === 0 ? <Text color={tones.dim}>보여 줄 카드가 없어요. 부품 mod 를 설치하거나 /hud 로 숨긴 카드를 확인하세요.</Text> : null}
        {shown.map(card => drawCard(el, card, width, tones))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (e.props.hasSurvey || s.layout === 'pane') return next(e)
    mem.bandSite = e.requestId ?? null
    mem.lastBlit.delete(mem.bandSite ?? '')
    const el = $.ui.resolve(e)
    const { Box } = el
    const ch = s.character === 'none' ? null : (await read($, characters))[s.character] ?? null
    const tones = tonesFor(s, ch)
    const v = await read($, live)
    const brief = briefLine(arrange(await read($, cards), s))
    const cells = await petCells($)
    return (
      <Box flexDirection="row">
        {cells ? drawPet(el, e.surface === 'terminal', cells, rasterCells(cells)) : null}
        <Box flexDirection="column" marginLeft={cells ? 2 : 0} flexShrink={1}>
          {drawSpeech(el, v.speech, tones, ch)}
          {brief.length ? drawLine(el, brief, tones, 'brief') : null}
        </Box>
      </Box>
    )
  })
}
