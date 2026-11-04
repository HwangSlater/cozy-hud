// cozy-hud 코어: $.hud 를 더하고, 부품이 보낸 카드와 캐릭터를 패널·입력창 위 줄에 그린다.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HudCard, HudCharacter, HudLive, HudSettings, HudView } from '../types'
import { briefLine, drawCard, drawLine, drawPet, drawRows, drawSpeech, type Tones } from './draw'
import { drawnAt, forgetSite, petArt } from './motion'
import { notifyDone } from './notify'
import { addFile, countToday, showToday } from './today'
import { drawSettings } from './pages'
import { characterNav, drawCharacterGrid, ensurePanes, openSettings, type CharacterNav } from './panel'
import { DEFAULTS, arrange, fromStore, runCommand, type ThemeSpec } from './settings'
import {
  PANE, SETTINGS_PANE, addCharacters, loadStored, resetCharacters, mem, saveSettings, sendOptions, setMood, syncFromState, type $,
} from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-3' })
const live = atom({ plugin: 'cozy-hud', key: 'live' } as const, { mood: 'idle', speech: '', since: 0 } as HudLive, { shape: 'live-1' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { path: [], canUndo: false } as HudView, { shape: 'view-4' })

/** 기뻐하거나 걱정하는 표정이 남는 시간 */
const REACT_MS = 2500
/** 컨텍스트가 이만큼 차면 땀 */
const SWEAT_PERCENT = 80
const MINUTE = 60 * 1000
/** 미리보기 상자의 테두리 두 칸 + 안쪽 여백 두 칸 */
const PREVIEW_INSET = 4
/** 캐릭터 옆에 말풍선을 둘 때 말풍선에 남겨야 할 최소 칸(이보다 좁으면 아래로) */
const MIN_SPEECH_COLUMNS = 16
/** 캐릭터 이름 버튼의 「[ 」·「 ▾ ]」가 더 차지하는 칸 */
const NAME_BUTTON_EXTRA = 6
/** 「[ < ] 이름 칸 [ > ]」 한 줄에서 이름 칸 말고 더 드는 칸(버튼 둘 · 사이 · 이름 버튼 테두리). 이보다 좁으면 두 줄 */
const NAV_ROW_EXTRA = 5 + 1 + NAME_BUTTON_EXTRA + 1 + 5
/** 캐릭터 없이 말할 때 앞에 붙이는 표시 */
const SPEECH_MARK = '▸'

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

/** 「쓰다듬기」: 캐릭터가 한 번 기뻐하고(반응을 켰으면 「헤헤」), 오늘 기록에 센다 */
async function petPet($: $) {
  const s = await read($, settings)
  await setMood($, 'happy', s.speech.react === 'on' ? '헤헤' : '')
  mem.reactTimer?.cancel()
  mem.reactTimer = $.clock.after(REACT_MS, () => void restMood($))
  await countToday($, s.today === 'on', t => ({ ...t, pets: t.pets + 1 }))
}

/** 고친 파일로 세는 도구 */
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

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
  // 설정 미리보기는 지금 말풍선 대신 고른 말풍선 설정의 예시를 보여 준다. 일하는 동안 도구마다 바뀌는 말풍선을
  // 읽으면 설정 패널 전체가 계속 다시 그려져, 그 사이에 누른 클릭을 놓친다
  const speech = nav ? toolTalk('Read', { file_path: 'register.tsx' }, s.speech.tools) : (await read($, live)).speech
  const pet = petArt(s.size.pane)
  if (pet) drawnAt(site, pet.encoded)
  else forgetSite(site)
  // 설정 미리보기(nav 있음): 캐릭터 · 「< 이름 >」 · 순번 · 말풍선을 가운데 한 줄기로 쌓아 좌우 대칭
  const stage = nav ? (
    <Box key="stage" flexDirection="column" alignItems="center">
      {pet ? drawPet(el, surface === 'terminal', pet.cells, pet.encoded) : <Text color={tones.dim}>(캐릭터 없음)</Text>}
      {columns >= nav.nameColumns + NAV_ROW_EXTRA ? (
        <Box key="ch-nav" flexDirection="column" alignItems="center">
          <Box flexDirection="row" columnGap={1}>
            {/* ◀ ▶ 는 터미널·글꼴에 따라 한 칸이 되기도 두 칸이 되기도 해 줄이 흔들려서, 늘 한 칸인 < > 를 쓴다.
                한 글자짜리는 마우스로 맞히기 어려워 테두리 있는 버튼([ < ])으로 누를 자리를 넓히고, A/D 로도 넘긴다 */}
            <Button key="ch-prev" label="<" hotkey="a" onPress={nav.prev} />
            {/* 이름 버튼을 누르면 이름 격자가 펼쳐지고, 다시 누르거나 하나를 고르면 닫힌다 */}
            <Box width={nav.nameColumns + NAME_BUTTON_EXTRA} justifyContent="center">
              <Button key="character" onPress={nav.toggle}>{`${nav.label} ${nav.isOpen ? '▴' : '▾'}`}</Button>
            </Box>
            <Button key="ch-next" label=">" hotkey="d" onPress={nav.next} />
          </Box>
          <Text color={tones.dim}>{nav.count}</Text>
        </Box>
      ) : (
        // 좁은 판: 한 줄에 다 들어가지 않아 넘쳐 빈 줄이 되던 것을, 이름을 위 줄로 올리고 [ < ] 순번 [ > ] 를 아래 줄에
        <Box key="ch-nav" flexDirection="column" alignItems="center">
          {/* 버튼을 상자로 감싸야 가운데 맞춤이 먹어 캐릭터 밑 가운데에 선다(그냥 두면 왼쪽으로 붙음) */}
          <Box justifyContent="center">
            <Button key="character" onPress={nav.toggle}>{`${nav.label} ${nav.isOpen ? '▴' : '▾'}`}</Button>
          </Box>
          <Box flexDirection="row" columnGap={1}>
            <Button key="ch-prev" label="<" hotkey="a" onPress={nav.prev} />
            <Text color={tones.dim}>{nav.count.replace(/ /g, '')}</Text>
            <Button key="ch-next" label=">" hotkey="d" onPress={nav.next} />
          </Box>
        </Box>
      )}
      {nav.isOpen ? drawCharacterGrid(el, nav, columns) : null}
      {drawSpeech(el, speech, tones, ch)}
    </Box>
  ) : pet ? (
    // 캐릭터 옆에 말풍선 자리가 모자라면(크게 고른 좁은 판) 말풍선을 아래로 내린다
    <Box flexDirection={columns - (pet.cells[0]?.length ?? 0) - 2 >= MIN_SPEECH_COLUMNS ? 'row' : 'column'}>
      <Box flexDirection="column" alignItems="center">
        {drawPet(el, surface === 'terminal', pet.cells, pet.encoded)}
        {s.petButton === 'on' ? <Button key="pet" label="쓰다듬기" onPress={() => void petPet($)} /> : null}
      </Box>
      <Box flexDirection="column" marginLeft={columns - (pet.cells[0]?.length ?? 0) - 2 >= MIN_SPEECH_COLUMNS ? 2 : 0} flexShrink={1}>
        {drawSpeech(el, speech, tones, ch)}
      </Box>
    </Box>
    // 캐릭터를 숨겼거나 없으면 상자 없이 「▸ 하는 일」 한 줄(좁은 패널에서 줄이 넘치지 않게 끝을 자름)
  ) : speech ? <Text color={tones.accent} wrap="truncate-end">{`${SPEECH_MARK} ${speech}`}</Text> : null
  return (
    <Box flexDirection="column">
      {stage}
      {shown.length === 0 ? <Text color={tones.dim}>보여 줄 카드가 없어요. /hud 의 「카드」 탭에서 숨긴 카드를 확인하세요.</Text> : null}
      {s.form === 'small'
        ? drawRows(el, shown, s.hiddenRows, columns, tones)
        : shown.map(card => drawCard(el, card, columns, tones, s.form))}
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
    // HUD 와 HUD 설정은 늘 탭 두 개로 같이 둔다. 세션 시작을 붙잡지 않게 기다리지 않는다
    void ensurePanes($, saved.layout)
    // 기본 캐릭터는 코어에 들어 있다. 다른 팩(개인 팩 등)은 ready 를 듣고 다시 보낸다
    await resetCharacters($, JSON.parse(await $.fs.read(`${$.plugin.root}/data/characters.json`)) as HudCharacter[])
    await $.command.register({ name: 'hud', description: 'cozy-hud 설정 패널 열기', argumentHint: '[layout|character|theme|reset]' })
    const answer = await next(e)
    await $.hud.ready({})
    await showToday($, saved.today === 'on').catch(() => undefined)
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

  // 「HUD」·「HUD 설정」 두 탭은 늘 떠 있어야 해서(사용자 결정) 사람이 ✕ 로 닫는 것을 막는다.
  // HUD 탭은 배치를 「입력창 위만」으로 바꿀 때(코어가 닫음)만 닫힌다. 엔진이 내리는 것(unload)은 막을 수 없어 ensurePanes 가 되살린다
  on('ui.close', async ($, e, next) => {
    // next 없이 답하면 엔진이 탭을 닫지 않는다
    if (e.id === SETTINGS_PANE && e.origin.kind !== 'unload') return { value: undefined }
    if (e.id === PANE && e.origin.kind === 'person') return { value: undefined }
    return next(e)
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
    const ran = await next(e)
    // 도구가 이미 돌았으니 여기서 난 오류는 삼킨다(바깥 .catch 가 도구를 한 번 더 돌리지 않게)
    try {
      const input = e as unknown as { file_path?: string; notebook_path?: string }
      const path = input.file_path ?? input.notebook_path
      if (e.agentId === undefined && EDIT_TOOLS.has(e.tool) && path && ran.deny === undefined && !ran.isError) {
        await countToday($, (await read($, settings)).today === 'on', t => addFile(t, path))
      }
    } catch (err) {
      $.ui.log(`cozy-hud: 오늘 기록을 세지 못했어요 — ${String(err)}`, { to: 'debug' })
    }
    return ran
  })
    // 실패해도 도구 결과는 그대로 넘긴다
    .catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await wakeAfterTurn($)
      const s = await read($, settings)
      await notifyDone($, s, e.durationMs, e.isAborted)
      if (!e.isAborted) await countToday($, s.today === 'on', t => ({ ...t, answers: t.answers + 1, workMs: t.workMs + e.durationMs })).catch(() => undefined)
      void ensurePanes($, (await read($, settings)).layout)
    }
    return next(e)
  })

  // ── 그리기 ──
  // 설정 패널 맨 위에 HUD 패널을 그대로 그려(미리보기), 바꾼 값을 탭을 넘기지 않고 본다
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const s = await read($, settings)
    const tones = tonesFor(s, await currentCharacter($))
    const isPreview = s.layout !== 'band'
    const nav = await characterNav($)
    if (!isPreview) forgetSite(SETTINGS_PANE)
    return (
      // 미리보기를 맨 위에 둬 설정 쪽을 오가도 늘 보인다(쪽마다 내용이 짧아 같이 한 화면에 들어간다)
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column" borderStyle="round" borderColor={tones.accent} paddingX={1}>
          <Text bold color={tones.accent}>미리보기</Text>
          {isPreview
            ? await drawHud($, el, e.surface, e.props.bodyColumns - PREVIEW_INSET, SETTINGS_PANE, nav)
            : <Text color={tones.dim}>지금은 입력창 위 줄에만 보여요. 아래 줄에서 바로 확인하세요.</Text>}
        </Box>
        {await drawSettings($, el, tones, e.surface, e.props.bodyColumns)}
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
    // 입력창 위 줄은 하나를 여러 mod 가 같이 쓴다. 아래(다른 mod·엔진)가 그린 것을 받아 우리 줄 밑에 함께 둔다
    // (next 를 넘기지 않으면 다른 mod 의 줄이 사라진다)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {pet ? drawPet(el, e.surface === 'terminal', pet.cells, pet.encoded) : null}
          <Box flexDirection="column" marginLeft={pet ? 2 : 0} flexShrink={1}>
            {drawSpeech(el, v.speech, tones, ch)}
            {brief.length ? drawLine(el, brief, tones, 'brief') : null}
          </Box>
        </Box>
        {below}
      </Box>
    )
  })
}
