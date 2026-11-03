// cozy-hud 코어: $.hud 를 더하고, 부품이 보낸 카드와 캐릭터를 패널·입력창 위 줄에 그린다.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudMood, HudSettings, HudView } from '../types'
import { briefLine, drawCard, drawLine, drawPet, drawSpeech, type Tones } from './draw'
import { rasterCells } from './look'
import { drawSettings, openSettings } from './panel'
import { DEFAULTS, arrange, fromStore, runCommand, type ThemeSpec } from './settings'
import { PANE, SETTINGS_PANE, loadStored, mem, petCells, saveSettings, sendOptions, type $ } from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-2' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { tab: 'character', canUndo: false } as HudView, { shape: 'view-2' })

/** 움직임의 가장 짧은 간격. 「보통」은 두 번에 한 번, 「느리게」는 네 번에 한 번 프레임이 넘어간다 */
const TICK_MS = 125
const TICKS_PER_FRAME = { fast: 1, normal: 2, slow: 4, off: 0 } as const
/** 기뻐하거나 걱정하는 표정이 남는 시간 */
const REACT_MS = 2500
/** 컨텍스트가 이만큼 차면 땀 */
const SWEAT_PERCENT = 80
const MINUTE = 60 * 1000

const VERB: Record<string, string> = { Read: '읽는 중', Grep: '찾는 중', Glob: '찾는 중', Edit: '고치는 중', Write: '쓰는 중', Bash: '실행하는 중' }

async function setMood($: $, mood: HudMood, speech: string) {
  await update($, live, () => ({ mood, speech, since: Date.now() }))
}

async function restMood($: $) {
  const usage = await $.session.usage().catch(() => null)
  const percent = usage?.context.percent ?? 0
  const s = await read($, settings)
  if (percent >= SWEAT_PERCENT) await setMood($, 'sweat', s.speech.react === 'on' ? `컨텍스트 ${percent}% — 곧 압축돼요` : '')
  else await setMood($, mem.isWorking ? 'work' : 'idle', '')
}

function tonesFor(s: HudSettings, ch: HudCharacter | null): Tones {
  const spec: ThemeSpec | undefined = mem.themes[s.theme] ?? mem.themes.auto
  const t = spec?.tones ?? {}
  const pick = (k: string) => (t[k] === '@character' ? ch?.accent ?? 'claude' : t[k] ?? 'text')
  return { text: pick('text'), dim: pick('dim'), strong: pick('strong'), accent: pick('accent'), ok: pick('ok'), warn: pick('warn'), err: pick('err'), line: pick('line') }
}

async function currentCharacter($: $): Promise<HudCharacter | null> {
  const s = await read($, settings)
  return s.character === 'none' ? null : (await read($, characters))[s.character] ?? null
}

// 터미널에서는 다시 그리지 않고 캐릭터 칸만 바꿔 끼운다. 자리마다 크기가 다를 수 있다
async function animate($: $) {
  const s = await read($, settings)
  const every = TICKS_PER_FRAME[s.motion.speed]
  if (every === 0 || ++mem.tick % every !== 0) return
  mem.frame++
  const sites: [string | null, HudSettings['size']['pane']][] = [
    [PANE, s.size.pane], [mem.bandSite, s.size.band], [mem.isSettingsShown ? SETTINGS_PANE : null, s.size.pane],
  ]
  for (const [site, size] of sites) {
    if (!site) continue
    const cells = await petCells($, size)
    if (!cells) continue
    const encoded = rasterCells(cells)
    if (mem.lastBlit.get(site) === encoded) continue
    const r = await $.ui.blit({ requestId: site, key: 'pet', cells: encoded }).catch(() => ({ deny: 'error' }))
    if (!('deny' in r) || r.deny === undefined) mem.lastBlit.set(site, encoded)
    else if (site === SETTINGS_PANE) mem.isSettingsShown = false
  }
}

async function wakeAfterTurn($: $) {
  mem.isWorking = false
  if ((await read($, live)).mood !== 'happy') await restMood($)
  mem.sleepTimer?.cancel()
  const sleep = (await read($, settings)).motion.sleep
  if (sleep !== 'never') mem.sleepTimer = $.clock.after(Number(sleep) * MINUTE, () => void setMood($, 'sleep', ''))
}

/** 도구 이름과 입력으로 말풍선 글. 설정에 따라 파일 이름까지 · 하는 일만 · 없음 */
function toolTalk(tool: string, input: { file_path?: string; pattern?: string; command?: string }, mode: HudSettings['speech']['tools']) {
  const verb = VERB[tool]
  if (!verb || mode === 'off') return ''
  if (mode === 'verb') return verb
  const target = input.file_path?.split(/[\\/]/).pop() ?? input.pattern ?? input.command?.slice(0, 24) ?? ''
  return `${target} ${verb}`.trim()
}

export const register: Register = on => {
  // ── $.hud: 다른 mod 가 부르는 입구. 실제 일은 아래 hud.* 훅이 $ 를 들고 한다 ──
  on('engine.create', async (_$, e, next) => {
    const built = await next(e)
    const ack = async () => ({ isDone: true as const })
    return { ...built, hud: { put: ack, drop: ack, characters: ack, say: ack, option: ack } }
  })

  on('hud.put', async ($, e, next) => {
    await update($, cards, all => ({ ...all, [e.id]: e }))
    await sendOptions($, e, await read($, settings))
    return next(e)
  })
  on('hud.drop', async ($, e, next) => {
    await update($, cards, all => Object.fromEntries(Object.entries(all).filter(([id]) => id !== e.id)))
    mem.sentOptions.delete(e.id)
    return next(e)
  })
  on('hud.characters', async ($, e, next) => {
    await update($, characters, all => ({ ...all, ...Object.fromEntries(e.list.map(ch => [ch.id, ch])) }))
    return next(e)
  })
  on('hud.say', async ($, e, next) => {
    const isOn = (await read($, settings)).speech.react === 'on'
    await setMood($, e.kind === 'cheer' ? 'happy' : 'sweat', isOn ? e.text : '')
    mem.reactTimer?.cancel()
    mem.reactTimer = $.clock.after(REACT_MS, () => void restMood($))
    return next(e)
  })

  // ── 세션 시작: 고른 값 불러오기 · 명령 · 패널 · 움직임 ──
  on('session.start', async ($, e, next) => {
    mem.themes = JSON.parse(await $.fs.read(`${$.plugin.root}/themes.json`)) as Record<string, ThemeSpec>
    const saved = fromStore(await loadStored($))
    await update($, settings, () => saved)
    await $.command.register({ name: 'hud', description: 'cozy-hud 설정 패널 열기', argumentHint: '[layout|character|theme|reset]' })
    if (saved.layout !== 'band') void $.ui.open({ id: PANE, title: 'HUD' })
    $.clock.every(TICK_MS, () => void animate($))
    return next(e)
  })

  // 이름 없이 /hud 는 설정 패널, 뒤에 말을 붙이면 예전처럼 바로 바꾼다
  on('command.run', { command: 'hud' }, async ($, e) => {
    if (!e.args.replace(/[[\]<>]/g, '').trim()) {
      await openSettings($)
      return { text: 'HUD 설정 패널을 열었어요.' }
    }
    const s = await read($, settings)
    const { next, text } = runCommand(e.args, s, { themes: mem.themes, characters: await read($, characters), cards: await read($, cards) })
    if (next) await saveSettings($, () => next)
    return { text }
  })

  on('ui.close', { id: SETTINGS_PANE }, async ($, e, next) => {
    mem.isSettingsShown = false
    mem.undo = null
    await update($, view, v => ({ ...v, canUndo: false }))
    return next(e)
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
      const talk = toolTalk(e.tool, e as unknown as { file_path?: string; pattern?: string; command?: string }, (await read($, settings)).speech.tools)
      if ((await read($, live)).mood === 'work') await update($, live, v => ({ ...v, speech: talk }))
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
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const s = await read($, settings)
    return drawSettings($, $.ui.resolve(e), tonesFor(s, await currentCharacter($)), e.surface)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const s = await read($, settings)
    const ch = await currentCharacter($)
    const tones = tonesFor(s, ch)
    const shown = arrange(await read($, cards), s)
    const v = await read($, live)
    const cells = await petCells($, s.size.pane)
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
        {shown.length === 0 ? <Text color={tones.dim}>보여 줄 카드가 없어요. /hud 의 「카드」 탭에서 숨긴 카드를 확인하세요.</Text> : null}
        {shown.map(card => drawCard(el, card, e.props.bodyColumns, tones))}
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
    const ch = await currentCharacter($)
    const tones = tonesFor(s, ch)
    const v = await read($, live)
    const brief = briefLine(arrange(await read($, cards), s))
    const cells = await petCells($, s.size.band)
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
