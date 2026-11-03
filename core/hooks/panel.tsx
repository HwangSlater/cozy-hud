// 설정 패널: 탭(캐릭터 · 배치·말풍선 · 테마 · 카드)마다 버튼과 목록으로 고른다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { HudCard, HudCharacter, HudOption, HudSettings, HudTab, HudView } from '../types'
import { cellWidth, type Tones } from './draw'
import {
  DEFAULTS, LAYOUTS, REACT, SIZES, SLEEPS, SPEEDS, TOOL_TALK,
  moveCard, optionValues, ordered, setOption, toggleHidden,
} from './settings'
import { SETTINGS_PANE, mem, saveSettings, type $ } from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-2' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { tab: 'character', canUndo: false } as HudView, { shape: 'view-2' })

type El = ReturnType<EngineInterface['ui']['resolve']>
/** 목록·입력칸이 있는 화면의 표. 없는 화면에서는 두 칸이 비어 있다 */
type Pickers = Partial<Pick<Extract<El, { Select: unknown }>, 'Select' | 'Input'>>

const TABS: Record<HudTab, string> = { character: '캐릭터', layout: '배치·말풍선', theme: '테마', cards: '카드' }

/** 패널이 키보드를 잡았을 때와 아닐 때 맨 위에 보이는 안내 */
const KEY_HELP = {
  focused: 'Tab 다음 칸 · Enter 고르기 · 1~4 탭 · A/D 캐릭터 넘기기 · Esc 나가기',
  idle: '키보드로 바꾸려면 Ctrl+X 다음 Tab 을 누르세요',
}

/** 이만큼까지는 펼치는 목록 대신 버튼 줄로 보여 한 번에 고르게 한다 */
const MAX_BUTTON_CHOICES = 5
/** 항목 이름 칸 너비(가장 긴 「입력창 위 크기」·「끝냄·경고 반응」에 맞춤). 버튼이 세로로 가지런히 선다 */
const LABEL_COLUMNS = 17
/** 고른 버튼 앞에 붙이는 표시. 색이 잘 안 보이는 터미널에서도 무엇을 골랐는지 알게 한다 */
const PICKED_MARK = '✓'
/** 카드별 설정 줄을 카드 이름보다 들여 쓰는 칸 */
const OPTION_INDENT = 4

/** 항목 이름을 칸 수에 맞춰 오른쪽을 공백으로 채운다(한글은 두 칸) */
const padLabel = (label: string) => label + ' '.repeat(Math.max(1, LABEL_COLUMNS - cellWidth(label)))


/** 표(값 → 이름)를 Select 의 목록으로 */
const choices = (table: Record<string, string>) => Object.entries(table).map(([value, label]) => ({ value, label }))

export const SETTINGS_TITLE = 'HUD 설정'

/** 설정 탭을 앞으로 꺼내고 키보드를 준다. Esc 는 키보드만 돌려주고 탭은 남는다 */
export async function openSettings($: $) {
  await $.ui.open({ id: SETTINGS_PANE, title: SETTINGS_TITLE, focus: true })
}

/** 버튼 하나가 차지하는 칸: 「[ 이름 ]」 + 사이 한 칸 */
const buttonColumns = (label: string) => cellWidth(label) + 5

/** 묶음 제목: 굵은 이름 + 판 끝까지 흐린 가로줄 */
function section(el: El, columns: number, tones: Tones, key: string, title: string, isFirst = false) {
  const { Box, Text } = el
  return (
    <Box key={key} marginTop={isFirst ? 0 : 1} flexDirection="row">
      <Text bold color={tones.strong}>{title} </Text>
      <Text color={tones.line}>{'─'.repeat(Math.max(0, columns - cellWidth(title) - 1))}</Text>
    </Box>
  )
}

/**
 * 하나 고르기: 고를 것이 적으면 버튼 줄(한 번 클릭), 많으면 펼치는 목록. 목록이 없는 화면(모바일)은 늘 버튼 줄.
 * 버튼 줄이 이름 옆에 다 들어가면 한 줄, 아니면 이름 아래에 들여 써서 넘쳐도 어느 항목인지 보이게 한다.
 */
function pickList(el: El, columns: number, key: string, label: string, options: readonly { value: string; label: string }[], value: string, onPick: (v: string) => void) {
  const { Box, Text, Button } = el
  const { Select } = el as Pickers
  if (Select && options.length > MAX_BUTTON_CHOICES) {
    return <Select key={key} label={padLabel(label)} options={options} value={value} onSelect={v => onPick(v)} />
  }
  // 고르지 않은 버튼도 표시 자리만큼 빈칸을 둬, 고를 때 뒤 버튼이 밀리지 않게 한다
  const shown = (o: { value: string; label: string }) => (o.value === value ? PICKED_MARK : ' ') + o.label
  const buttons = options.map(o => (
    <Button key={`${key}-${o.value}`} variant={o.value === value ? 'primary' : undefined} onPress={() => onPick(o.value)}>{shown(o)}</Button>
  ))
  const isOneLine = LABEL_COLUMNS + options.reduce((sum, o) => sum + buttonColumns(shown(o)), 0) <= columns
  if (isOneLine) {
    return (
      <Box key={key} flexDirection="row" columnGap={1}>
        <Text>{padLabel(label)}</Text>
        {buttons}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="column">
      <Text>{label}</Text>
      <Box marginLeft={2} flexDirection="row" flexWrap="wrap" columnGap={1}>{buttons}</Box>
    </Box>
  )
}

const pickRow = (el: El, columns: number, key: string, label: string, table: Record<string, string>, value: string, onPick: (v: string) => void) =>
  pickList(el, columns, key, label, choices(table), value, onPick)

/** 고를 수 있는 캐릭터 이름(마지막은 「없음」) */
const characterNames = (list: readonly HudCharacter[]) => [...list.map(c => ({ value: c.id, label: c.name })), { value: 'none', label: '없음' }]

/**
 * nameColumns: 가장 긴 이름의 칸 수(이름 칸을 이만큼 잡아 < > 자리가 넘겨도 그대로).
 * options·value·pick: 이름 버튼을 누르면 펼치는 이름 격자. 하나를 고르면 닫힌다. isOpen·toggle: 펼침 상태
 */
export type CharacterNav = {
  label: string; count: string; nameColumns: number; prev: () => void; next: () => void
  options: readonly { value: string; label: string }[]; value: string; pick: (id: string) => void
  isOpen: boolean; toggle: () => void
}

/** 미리보기에서 ◀ ▶ 로 캐릭터를 하나씩 넘길 때 쓰는 값 */
export async function characterNav($: $): Promise<CharacterNav> {
  const names = characterNames(Object.values(await read($, characters)))
  const picked = (await read($, settings)).character
  const at = Math.max(0, names.findIndex(n => n.value === picked))
  const isOpen = (await read($, view)).picking === true
  const setOpen = (open: boolean) => void update($, view, x => ({ ...x, picking: open }))
  const save = (id: string) => void saveSettings($, x => ({ ...x, character: id }))
  const go = (by: number) => save(names[(at + by + names.length) % names.length]?.value ?? 'none')
  const pick = (id: string) => {
    save(id)
    setOpen(false)
  }
  const count = `${at + 1} / ${names.length}`
  const nameColumns = Math.max(cellWidth(count), ...names.map(n => cellWidth(n.label)))
  return {
    label: names[at]?.label ?? '', count, nameColumns, prev: () => go(-1), next: () => go(1),
    options: names, value: names[at]?.value ?? 'none', pick, isOpen, toggle: () => setOpen(!isOpen),
  }
}

/** 이름 격자 한 칸: 「[ ✓이름 ]」 + 사이 한 칸 */
const gridCellColumns = (nameColumns: number) => nameColumns + 6

/**
 * 펼친 캐릭터 이름 격자. 칸 너비를 가장 긴 이름에 맞춰 세로줄이 맞고, 한 번 눌러 고르면 닫힌다.
 * 터미널의 펼치는 목록(Select)은 마우스로 항목을 고르거나 닫을 수 없어서 버튼으로 만든다.
 */
export function drawCharacterGrid(el: El, nav: CharacterNav, columns: number) {
  const { Box, Button } = el
  const cell = gridCellColumns(nav.nameColumns)
  const perRow = Math.max(1, Math.floor(columns / cell))
  const rows: (typeof nav.options)[] = []
  for (let i = 0; i < nav.options.length; i += perRow) rows.push(nav.options.slice(i, i + perRow))
  return (
    <Box key="ch-grid" flexDirection="column" alignItems="center" marginTop={1}>
      {rows.map((row, r) => (
        <Box key={`ch-grid-${r}`} flexDirection="row">
          {row.map(o => (
            <Box key={`ch-cell-${o.value}`} width={cell}>
              <Button key={`pick-${o.value}`} variant={o.value === nav.value ? 'primary' : undefined} onPress={() => nav.pick(o.value)}>
                {(o.value === nav.value ? PICKED_MARK : ' ') + o.label}
              </Button>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

async function characterTab($: $, el: El, columns: number, s: HudSettings, tones: Tones) {
  const { Box, Text } = el
  const list = Object.values(await read($, characters))
  const save = (change: (s: HudSettings) => HudSettings) => void saveSettings($, change)
  return (
    <Box flexDirection="column">
      {/* 캐릭터 고르기는 미리보기의 넘기기 줄(「[ < ] 이름 ▾ [ > ]」)에서 한다 */}
      {section(el, columns, tones, 'sec-look', '크기', true)}
      {pickRow(el, columns, 'size-pane', '패널 크기', SIZES, s.size.pane, v => save(x => ({ ...x, size: { ...x.size, pane: v as HudSettings['size']['pane'] } })))}
      {pickRow(el, columns, 'size-band', '입력창 위 크기', SIZES, s.size.band, v => save(x => ({ ...x, size: { ...x.size, band: v as HudSettings['size']['band'] } })))}
      {section(el, columns, tones, 'sec-motion', '움직임')}
      {pickRow(el, columns, 'speed', '속도', SPEEDS, s.motion.speed, v => save(x => ({ ...x, motion: { ...x.motion, speed: v as HudSettings['motion']['speed'] } })))}
      {pickRow(el, columns, 'sleep', '잠들기', SLEEPS, s.motion.sleep, v => save(x => ({ ...x, motion: { ...x.motion, sleep: v as HudSettings['motion']['sleep'] } })))}
      {list.length === 0 ? <Text color={tones.dim}>캐릭터를 불러오지 못했어요. 코어를 다시 설치해 보세요.</Text> : null}
    </Box>
  )
}

function layoutTab($: $, el: El, columns: number, s: HudSettings, tones: Tones) {
  const { Box, Text } = el
  const save = (change: (s: HudSettings) => HudSettings) => void saveSettings($, change)
  return (
    <Box flexDirection="column">
      {section(el, columns, tones, 'sec-place', '배치', true)}
      {pickRow(el, columns, 'layout', '보일 곳', LAYOUTS, s.layout, v => save(x => ({ ...x, layout: v as HudSettings['layout'] })))}
      {section(el, columns, tones, 'sec-speech', '말풍선')}
      {pickRow(el, columns, 'talk-tools', '도구를 쓸 때', TOOL_TALK, s.speech.tools, v => save(x => ({ ...x, speech: { ...x.speech, tools: v as HudSettings['speech']['tools'] } })))}
      {pickRow(el, columns, 'talk-react', '끝냄·경고 반응', REACT, s.speech.react, v => save(x => ({ ...x, speech: { ...x.speech, react: v as 'on' | 'off' } })))}
    </Box>
  )
}

function themeTab($: $, el: El, s: HudSettings) {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="column">
      {Object.entries(mem.themes).map(([id, t]) => {
        const swatch = ['accent', 'ok', 'warn', 'err'].map(k => t.tones[k] ?? 'text')
        return (
          <Box key={`theme-${id}`} flexDirection="row">
            <Button key={`th-${id}`} variant={id === s.theme ? 'primary' : undefined} onPress={() => void saveSettings($, x => ({ ...x, theme: id }))}>
              {t.name}
            </Button>
            <Text> </Text>
            {swatch.map((c, i) => <Text key={`sw-${id}-${i}`} color={c === '@character' ? 'claude' : c}>■</Text>)}
          </Box>
        )
      })}
    </Box>
  )
}

function optionRow($: $, el: El, columns: number, card: HudCard, o: HudOption, value: string) {
  const { Box, Text } = el
  const key = `opt-${card.id}-${o.key}`
  const save = (v: string) => void saveSettings($, x => setOption(x, card.id, o.key, v))
  const field = () => {
    if (o.kind === 'choice') return pickList(el, columns, key, o.label, o.choices, value, save)
    const { Input } = el as Pickers
    if (!Input) return <Text dimColor>{o.label}  {value || '(비어 있음)'} — 이 화면에서는 바꿀 수 없어요</Text>
    return <Input key={key} label={`${o.label}  `} placeholder={o.placeholder} value={value} submitLabel="저장" onSubmit={v => save(v.trim())} />
  }
  return <Box key={`${key}-row`} marginLeft={OPTION_INDENT}>{field()}</Box>
}

async function cardsTab($: $, el: El, columns: number, s: HudSettings, tones: Tones) {
  const { Box, Text, Button } = el
  const all = await read($, cards)
  const list = ordered(all, s)
  if (list.length === 0) return <Text color={tones.dim}>보여 줄 카드가 없어요. 부품 mod(cozy-hud-tokens 등)를 설치하세요.</Text>
  return (
    <Box flexDirection="column">
      {list.map((card, i) => {
        const isHidden = s.hidden.includes(card.id)
        const values = optionValues(card, s)
        return (
          <Box key={`card-${card.id}`} flexDirection="column" marginBottom={1}>
            <Box flexDirection="row" columnGap={1}>
              <Button key={`vis-${card.id}`} onPress={() => void saveSettings($, x => toggleHidden(x, card.id))}>
                {isHidden ? '숨김' : '보임'}
              </Button>
              <Text bold color={isHidden ? tones.dim : tones.strong}>{card.title}</Text>
              {i > 0 ? <Button key={`up-${card.id}`} onPress={() => void saveSettings($, x => moveCard(all, x, card.id, -1))}>위로</Button> : null}
              {i < list.length - 1 ? <Button key={`down-${card.id}`} onPress={() => void saveSettings($, x => moveCard(all, x, card.id, 1))}>아래로</Button> : null}
            </Box>
            {(card.options ?? []).map(o => optionRow($, el, columns - OPTION_INDENT, card, o, values[o.key] ?? o.value))}
          </Box>
        )
      })}
    </Box>
  )
}

async function resetAll($: $) {
  mem.undo = await read($, settings)
  await saveSettings($, () => DEFAULTS)
  await update($, view, v => ({ ...v, canUndo: true }))
}

async function undoReset($: $) {
  const before = mem.undo
  mem.undo = null
  await update($, view, v => ({ ...v, canUndo: false }))
  if (before) await saveSettings($, () => before)
}

/** 목록(Select)·입력칸(Input)이 없는 화면 */
const NO_PICKERS = new Set(['mobile'])

export async function drawSettings($: $, table: El, tones: Tones, surface: string, isFocused: boolean, columns: number) {
  // 모바일 표에도 Select 가 들어 있지만 그려지지 않아서, 화면 종류로 빼 버린다
  const el = (NO_PICKERS.has(surface) ? { ...table, Select: undefined, Input: undefined } : table) as El
  const { Box, Text, Button } = el
  const s = await read($, settings)
  const v = await read($, view)
  mem.isSettingsShown = true
  const body =
    v.tab === 'character' ? await characterTab($, el, columns, s, tones)
    : v.tab === 'layout' ? layoutTab($, el, columns, s, tones)
    : v.tab === 'theme' ? themeTab($, el, s)
    : await cardsTab($, el, columns, s, tones)
  return (
    <Box flexDirection="column">
      {surface === 'mobile' ? null : <Text color={tones.dim}>{isFocused ? KEY_HELP.focused : KEY_HELP.idle}</Text>}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {(Object.keys(TABS) as HudTab[]).map((tab, i) => (
          <Button
            key={`tab-${tab}`}
            hotkey={String(i + 1)}
            autoFocus={tab === v.tab ? true : undefined}
            variant={tab === v.tab ? 'primary' : undefined}
            onPress={() => void update($, view, x => ({ ...x, tab }))}
          >
            {`${i + 1} ${TABS[tab]}`}
          </Button>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">{body}</Box>
      <Box marginTop={1} flexDirection="row" columnGap={1}>
        {v.canUndo
          ? <Button key="undo" variant="primary" onPress={() => void undoReset($)}>되돌리기</Button>
          : <Button key="reset" onPress={() => void resetAll($)}>처음 설정으로</Button>}
        <Button key="close" role="dismiss" onPress={() => void $.ui.close({ id: SETTINGS_PANE })}>닫기</Button>
      </Box>
    </Box>
  )
}
