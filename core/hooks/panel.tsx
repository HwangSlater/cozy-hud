// 설정 패널의 부품: 탭 열기, 캐릭터 넘기기, 고르기 목록, 테마·카드 쪽, 초기화. 쪽 구조(설정 › 모양 › 캐릭터)는 pages.tsx.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { HudCard, HudCharacter, HudForm, HudLayout, HudOption, HudSettings, HudView } from '../types'
import { cellWidth, drawLine, type Tones } from './draw'
import { DEFAULTS, choicesInForm, moveCard, ordered, setOption, toggleHidden } from './settings'
import { PANE, SETTINGS_PANE, mem, saveSettings, type $ } from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const characters = atom({ plugin: 'cozy-hud', key: 'characters' } as const, {} as Readonly<Record<string, HudCharacter>>, { shape: 'characters-2' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-3' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { path: [], canUndo: false } as HudView, { shape: 'view-4' })

export type El = ReturnType<EngineInterface['ui']['resolve']>
/** 목록·입력칸이 있는 화면의 표. 없는 화면에서는 두 칸이 비어 있다 */
type Pickers = Partial<Pick<Extract<El, { Select: unknown }>, 'Select' | 'Input'>>

/** 고른 버튼 앞에 붙이는 표시. 색이 잘 안 보이는 터미널에서도 무엇을 골랐는지 알게 한다 */
export const PICKED_MARK = '✓'
/** 카드 순서 목록에서 한 줄 요약을 들여 쓰는 칸(순번 · 사이 · ✓ · 사이 다음, 카드 이름과 같은 자리) */
const SUMMARY_INDENT = 4
/** 글자 설정 입력칸이 비었을 때 보이는 말 */
const TEXT_PLACEHOLDER = '여기에 입력'

export const SETTINGS_TITLE = 'HUD 설정'

/** 설정 탭을 앞으로 꺼내고 키보드를 준다. Esc 는 키보드만 돌려주고 탭은 남는다 */
export async function openSettings($: $) {
  await $.ui.open({ id: SETTINGS_PANE, title: SETTINGS_TITLE, focus: true })
}

/**
 * 「HUD 설정」·「HUD」 두 탭이 늘 같이 열려 있게 한다. 세션 시작·다시 불러오기·답변이 끝날 때 부른다.
 * 사람은 두 탭을 닫을 수 없게 막아 두었고(register 의 ui.close), 다시 불러오기·그리기 오류로 엔진이 내린 탭을 되살린다.
 * 설정을 먼저 열어 HUD 가 앞에 온다. 열지 못하면 까닭을 디버그 기록에 남긴다.
 */
export async function ensurePanes($: $, layout: HudLayout) {
  const open = new Set((await $.ui.panes().catch(() => [])).map(p => p.id))
  const wanted = [{ id: SETTINGS_PANE, title: SETTINGS_TITLE }, ...(layout === 'band' ? [] : [{ id: PANE, title: 'HUD' }])]
  for (const pane of wanted) {
    if (open.has(pane.id)) continue
    const opened = await $.ui.open(pane).catch((err: unknown) => ({ isPlaced: false as const, reason: String(err) }))
    if (!opened.isPlaced) $.ui.log(`cozy-hud: 「${pane.title}」 탭을 열지 못했어요 — ${opened.reason}`, { to: 'debug' })
  }
}

/**
 * 하나 고르기(시안 1): 테두리 없는 줄을 한 줄에 하나씩. 고른 줄은 강조색 ✓ 와 굵은 글자.
 * 좁은 패널에서도 줄이 바뀌지 않고, 고른 뒤에도 그 쪽에 머물러 위 미리보기로 바로 비교한다
 */
export function choiceList(el: El, key: string, options: readonly { value: string; label: string }[], value: string, onPick: (v: string) => void, tones: Tones) {
  const { Box, Text, Button } = el
  return (
    <Box key={key} flexDirection="column">
      {options.map(o => {
        const isPicked = o.value === value
        return (
          <Box key={`${key}-${o.value}-row`}>
            <Button key={`${key}-${o.value}`} plain onPress={() => onPick(o.value)}>
              <Text color={tones.accent}>{isPicked ? PICKED_MARK : ' '}</Text>
              <Text color={isPicked ? tones.strong : tones.text} bold={isPicked}>{` ${o.label}`}</Text>
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

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

/** 테마 쪽: 고르기 줄과 같은 모양, 이름 뒤에 색 견본(이름 칸을 맞춰 견본이 세로로 선다) */
export function themePage($: $, el: El, s: HudSettings, tones: Tones) {
  const { Box, Text, Button } = el
  const themes = Object.entries(mem.themes)
  const nameColumns = Math.max(0, ...themes.map(([, t]) => cellWidth(t.name)))
  return (
    <Box flexDirection="column">
      {themes.map(([id, t]) => {
        const isPicked = id === s.theme
        const swatch = ['accent', 'ok', 'warn', 'err'].map(k => t.tones[k] ?? 'text')
        return (
          <Box key={`theme-${id}`}>
            <Button key={`th-${id}`} plain onPress={() => void saveSettings($, x => ({ ...x, theme: id }))}>
              <Text color={tones.accent}>{isPicked ? PICKED_MARK : ' '}</Text>
              <Text color={isPicked ? tones.strong : tones.text} bold={isPicked}>{` ${t.name}${' '.repeat(nameColumns - cellWidth(t.name))} `}</Text>
              {swatch.map((c, i) => <Text key={`sw-${id}-${i}`} color={c === '@character' ? 'claude' : c}>■</Text>)}
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

/** 카드 설정 하나: 이름 아래에 고르기 목록, 글자는 안내 · 입력칸을 줄마다 나눠 안내가 잘리지 않게 한다 */
export function optionField($: $, el: El, card: HudCard, o: HudOption, value: string, tones: Tones, form: HudForm) {
  const { Box, Text } = el
  const key = `opt-${card.id}-${o.key}`
  const save = (v: string) => void saveSettings($, x => setOption(x, card.id, o.key, v))
  const { Input } = el as Pickers
  return (
    <Box key={`${key}-field`} flexDirection="column" marginBottom={1}>
      <Text bold color={tones.strong}>{o.label}</Text>
      {o.kind === 'choice'
        ? choiceList(el, key, choicesInForm(o.choices, form), value, save, tones)
        : (
          <Box flexDirection="column">
            {o.placeholder ? <Text color={tones.dim}>{o.placeholder}</Text> : null}
            {Input
              ? <Input key={key} placeholder={TEXT_PLACEHOLDER} value={value} submitLabel="저장" onSubmit={v => save(v.trim())} />
              : <Text color={tones.dim}>{value || '(비어 있음)'} — 이 화면에서는 바꿀 수 없어요</Text>}
          </Box>
        )}
    </Box>
  )
}

/**
 * 「보일 카드와 순서」 한 줄(시안 1): 순번 · ✓카드 이름(누르면 보이기/숨기기) · 위 · 아래. 모두 테두리 없는 글자.
 * 맨 위·맨 아래의 위·아래도 흐리게 남겨 줄이 흔들리지 않게 한다
 */
function cardOrderRow($: $, el: El, all: Readonly<Record<string, HudCard>>, card: HudCard, i: number, count: number, s: HudSettings, titleColumns: number, tones: Tones) {
  const { Box, Text, Button } = el
  const isShown = !s.hidden.includes(card.id)
  const move = (by: -1 | 1) => () => void saveSettings($, x => moveCard(all, x, card.id, by))
  const still = () => {}
  const title = card.title + ' '.repeat(Math.max(0, titleColumns - cellWidth(card.title)))
  const isTop = i === 0, isBottom = i === count - 1
  // 줄 아래에 그 카드가 지금 보여 주는 한 줄 요약(입력창 위 줄과 같은 것). 숨긴 카드는 (숨김), 요약이 없으면 (요약 없음)
  const summary = !isShown
    ? <Text color={tones.dim}>(숨김)</Text>
    : card.brief?.length ? drawLine(el, card.brief, tones, `brief-${card.id}`) : <Text color={tones.dim}>(요약 없음)</Text>
  return (
    <Box key={`order-${card.id}`} flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text color={tones.dim}>{String(i + 1)}</Text>
        <Button key={`vis-${card.id}`} plain onPress={() => void saveSettings($, x => toggleHidden(x, card.id))}>
          <Text color={tones.accent}>{isShown ? PICKED_MARK : ' '}</Text>
          <Text color={isShown ? tones.strong : tones.dim} bold={isShown}>{` ${title}`}</Text>
        </Button>
        <Button key={`up-${card.id}`} plain dimColor={isTop ? true : undefined} onPress={isTop ? still : move(-1)}>위</Button>
        <Button key={`down-${card.id}`} plain dimColor={isBottom ? true : undefined} onPress={isBottom ? still : move(1)}>아래</Button>
      </Box>
      {summary ? <Box marginLeft={SUMMARY_INDENT} overflow="hidden">{summary}</Box> : null}
    </Box>
  )
}

/** 카드 쪽: 보일 카드와 순서. 카드별 설정은 모양마다 달라서 「모양」 아래에 있다 */
export async function cardsPage($: $, el: El, s: HudSettings, tones: Tones) {
  const { Box, Text } = el
  const all = await read($, cards)
  const list = ordered(all, s)
  if (list.length === 0) return <Text color={tones.dim}>보여 줄 카드가 없어요. 부품 mod(cozy-hud-tokens 등)를 설치하세요.</Text>
  const titleColumns = Math.max(...list.map(c => cellWidth(c.title)))
  return (
    <Box flexDirection="column">
      {list.map((card, i) => cardOrderRow($, el, all, card, i, list.length, s, titleColumns, tones))}
      <Box marginTop={1}><Text color={tones.dim}>카드별 설정은 「모양」에 있어요</Text></Box>
    </Box>
  )
}

export async function resetAll($: $) {
  mem.undo = await read($, settings)
  await saveSettings($, () => DEFAULTS)
  await update($, view, v => ({ ...v, canUndo: true }))
}

export async function undoReset($: $) {
  const before = mem.undo
  mem.undo = null
  await update($, view, v => ({ ...v, canUndo: false }))
  if (before) await saveSettings($, () => before)
}

/** 목록(Select)·입력칸(Input)이 없는 화면 */
export const NO_PICKERS = new Set(['mobile'])
