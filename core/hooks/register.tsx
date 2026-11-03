// cozy-hud 코어: $.hud 를 더하고, 부품이 보낸 카드와 캐릭터를 패널·입력창 위 줄에 그린다.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudSettings, HudView } from '../types'
import { briefLine, drawCard, drawLine, drawPet, drawSpeech, type Tones } from './draw'
import { drawnAt, forgetSite, petArt } from './motion'
import { SETTINGS_TITLE, characterNav, drawSettings, openSettings, type CharacterNav } from './panel'
import { DEFAULTS, arrange, fromStore, runCommand, type ThemeSpec } from './settings'
import {
  PANE, SETTINGS_PANE, addCharacters, loadStored, resetCharacters, mem, saveSettings, sendOptions, setMood, syncFromState, type $,
} from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-2' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { tab: 'character', canUndo: false } as HudView, { shape: 'view-2' })

/** 기뻐하거나 걱정하는 표정이 남는 시간 */
const REACT_MS = 2500
/** 컨텍스트가 이만큼 차면 땀 */
const SWEAT_PERCENT = 80
const MINUTE = 60 * 1000
/** 미리보기 상자의 테두리 두 칸 + 안쪽 여백 두 칸 */
const PREVIEW_INSET = 4

const VERB: Record<string, string> = { Read: '읽는 중', Grep: '찾는 중', Glob: '찾는 중', Edit: '고치는 중', Write: '쓰는 중', Bash: '실행하는 중' }

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

/** HUD 패널의 내용(캐릭터·말풍선·카드). HUD 패널과 설정 패널의 미리보기가 같이 쓴다 */
async function drawHud($: $, el: ReturnType<$['ui']['resolve']>, surface: string, columns: number, site: string, nav?: CharacterNav) {
  const { Box, Text, Button } = el
  const s = await read($, settings)
  const ch = await currentCharacter($)
  const tones = tonesFor(s, ch)
  const shown = arrange(await read($, cards), s)
  const v = await read($, live)
  const pet = petArt(s.size.pane)
  if (pet) drawnAt(site, pet.encoded)
  else forgetSite(site)
  return (
    <Box flexDirection="column">
      {pet ? (
        <Box flexDirection="row">
          {drawPet(el, surface === 'terminal', pet.cells, pet.encoded)}
          <Box flexDirection="column" marginLeft={2} flexShrink={1}>
            {drawSpeech(el, v.speech, tones, ch)}
          </Box>
        </Box>
      ) : v.speech ? <Text color={tones.accent}>{v.speech}</Text> : null}
      {nav ? (
        <Box key="ch-nav" flexDirection="row" columnGap={1} marginTop={pet ? 0 : 1}>
          <Button key="ch-prev" label="이전 캐릭터" onPress={nav.prev}>◀</Button>
          <Text bold color={tones.accent}>{nav.label}</Text>
          <Text color={tones.dim}>{nav.count}</Text>
          <Button key="ch-next" label="다음 캐릭터" onPress={nav.next}>▶</Button>
        </Box>
      ) : null}
      {shown.length === 0 ? <Text color={tones.dim}>보여 줄 카드가 없어요. /hud 의 「카드」 탭에서 숨긴 카드를 확인하세요.</Text> : null}
      {shown.map(card => drawCard(el, card, columns, tones))}
    </Box>
  )
}

export const register: Register = on => {
  // ── $.hud: 다른 mod 가 부르는 입구. 실제 일은 아래 hud.* 훅이 $ 를 들고 한다 ──
  on('engine.create', async (_$, e, next) => {
    const built = await next(e)
    const ack = async () => ({ isDone: true as const })
    return { ...built, hud: { put: ack, drop: ack, characters: ack, say: ack, option: ack, ready: ack } }
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
    await addCharacters($, e.list)
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
    await syncFromState($)
    // HUD 와 HUD 설정은 늘 탭 두 개로 같이 둔다(설정을 먼저 열어 HUD 가 앞에 오게)
    void (async () => {
      await $.ui.open({ id: SETTINGS_PANE, title: SETTINGS_TITLE })
      if (saved.layout !== 'band') await $.ui.open({ id: PANE, title: 'HUD' })
    })()
    // 기본 캐릭터는 코어에 들어 있다. 다른 팩(개인 팩 등)은 ready 를 듣고 다시 보낸다
    await resetCharacters($, JSON.parse(await $.fs.read(`${$.plugin.root}/data/characters.json`)) as HudCharacter[])
    await $.command.register({ name: 'hud', description: 'cozy-hud 설정 패널 열기', argumentHint: '[layout|character|theme|reset]' })
    const answer = await next(e)
    await $.hud.ready({})
    return answer
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
  // 설정 패널 아래에 HUD 패널을 그대로 그려, 바꾼 값을 탭을 넘기지 않고 본다
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const s = await read($, settings)
    const tones = tonesFor(s, await currentCharacter($))
    const isPreview = s.layout !== 'band'
    const nav = await characterNav($)
    if (!isPreview) forgetSite(SETTINGS_PANE)
    return (
      <Box flexDirection="column">
        {await drawSettings($, el, tones, e.surface, e.props.isFocused)}
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={tones.accent} paddingX={1}>
          <Text bold color={tones.accent}>미리보기</Text>
          {isPreview
            ? await drawHud($, el, e.surface, e.props.bodyColumns - PREVIEW_INSET, SETTINGS_PANE, nav)
            : <Text color={tones.dim}>지금은 입력창 위 줄에만 보여요. 아래 줄에서 바로 확인하세요.</Text>}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) =>
    drawHud($, $.ui.resolve(e), e.surface, e.props.bodyColumns, PANE))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (e.props.hasSurvey || s.layout === 'pane') return next(e)
    mem.bandSite = e.requestId ?? null
    const el = $.ui.resolve(e)
    const { Box } = el
    const ch = await currentCharacter($)
    const tones = tonesFor(s, ch)
    const v = await read($, live)
    const brief = briefLine(arrange(await read($, cards), s))
    const pet = petArt(s.size.band)
    if (mem.bandSite) {
      if (pet) drawnAt(mem.bandSite, pet.encoded)
      else forgetSite(mem.bandSite)
    }
    return (
      <Box flexDirection="row">
        {pet ? drawPet(el, e.surface === 'terminal', pet.cells, pet.encoded) : null}
        <Box flexDirection="column" marginLeft={pet ? 2 : 0} flexShrink={1}>
          {drawSpeech(el, v.speech, tones, ch)}
          {brief.length ? drawLine(el, brief, tones, 'brief') : null}
        </Box>
      </Box>
    )
  })
}
