// 설정 쪽 구조(시안 2-3): 처음 목록 → 묶음(모양 · 배치) → 항목 하나. 맨 위 경로 「설정 › 모양 › 캐릭터」의 칸을 누르면
// 그 단계로 바로 가서 뒤로를 여러 번 누르지 않아도 된다. 고른 뒤에도 그 쪽에 머물러 위 미리보기로 바로 비교한다.
import { atom, read, update } from 'claude-code'

import type { HudCard, HudForm, HudOption, HudSettings, HudView } from '../types'
import { cellWidth, rowsOf, type Tones } from './draw'
import { NO_PICKERS, PICKED_MARK, cardsPage, choiceList, optionField, resetAll, themePage, undoReset, type El } from './panel'
import {
  DEFAULTS, FORMS, FORM_HINT, FORM_PANE_SIZES, FORM_TOOL_TALK, LAYOUTS, NOTIFY_AFTER, PANE_SIZES, REACT, SIZES, SOUND, SLEEPS, SPEEDS, TOOL_TALK,
  applyForm, optionInForm, optionValues, ordered, toggleRow,
} from './settings'
import { mem, saveSettings, type $ } from './state'

// 엔진 검사는 이 파일 안의 atom 선언만 따라가서, 쓰는 파일마다 같은 이름·키로 선언한다(state.ts 와 같아야 함)
const cards = atom({ plugin: 'cozy-hud', key: 'cards' } as const, {} as Readonly<Record<string, HudCard>>, { shape: 'cards-1' })
const settings = atom({ plugin: 'cozy-hud', key: 'settings' } as const, DEFAULTS, { shape: 'settings-3' })
const view = atom({ plugin: 'cozy-hud', key: 'view' } as const, { path: [], canUndo: false } as HudView, { shape: 'view-4' })

/** 쪽 하나: 이름 · 목록에 보일 지금 값 · 내용. items 가 있으면 그 목록이 내용이고, 없으면 draw 가 그린다 */
type Page = {
  id: string
  label: string
  value: string
  items?: readonly Page[]
  draw?: () => JSX.Element | null | Promise<JSX.Element | null>
}

const ROOT_LABEL = '설정'
const CRUMB_GAP = ' › '
const MENU_ARROW = ' ›'
/** 목록 버튼에서 이름과 값 사이 칸 */
const MENU_GAP = 2
const ELLIPSIS = '…'

/** 칸 수에 맞춰 자른다(넘치면 끝에 …) */
function clip(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text
  let out = ''
  for (const ch of text) {
    if (cellWidth(out + ch) > columns - 1) break
    out += ch
  }
  return out + ELLIPSIS
}

/** 표(값 → 이름)를 고르기 목록으로. only 를 주면 그 값만 그 순서로 */
const table = (t: Record<string, string>, only?: readonly string[]) => (only ?? Object.keys(t)).map(value => ({ value, label: t[value] ?? value }))

/** 카드 설정 묶음이 목록에 보일 값: 하나면 그 값, 여럿이면 항목 수 */
function optionsSummary(options: readonly HudOption[], values: Record<string, string>): string {
  const [only] = options
  if (options.length !== 1 || !only) return `${options.length}개 항목`
  const v = values[only.key] ?? only.value
  return only.kind === 'choice' ? only.choices.find(c => c.value === v)?.label ?? v : v || '비어 있음'
}

/** 고른 모양에서 쓰는 쪽들. 모양에 따라 항목이 달라진다(「작게」만 보일 줄, 카드 설정은 그 모양의 항목만) */
async function formPages($: $, el: El, s: HudSettings, tones: Tones, shown: readonly HudCard[]): Promise<Page[]> {
  const { Box, Text, Button } = el
  const save = (change: (s: HudSettings) => HudSettings) => void saveSettings($, change)
  const form = s.form
  const rows = shown.flatMap(card => rowsOf(card).map(r => ({ id: `${card.id}.${r.key}`, label: r.label })))
  const withOptions = shown.filter(c => (c.options ?? []).some(o => optionInForm(o, form)))
  return [
    {
      id: 'form', label: '모양', value: FORMS[form],
      draw: () => (
        <Box flexDirection="column">
          {choiceList(el, 'form', table(FORMS), form, v => save(x => applyForm(x, v as HudForm)), tones)}
          <Text color={tones.dim}>{FORM_HINT[form]}</Text>
        </Box>
      ),
    },
    {
      id: 'size-pane', label: '캐릭터', value: PANE_SIZES[s.size.pane],
      draw: () => choiceList(el, 'size-pane', table(PANE_SIZES, FORM_PANE_SIZES[form]), s.size.pane, v => save(x => ({ ...x, size: { ...x.size, pane: v as HudSettings['size']['pane'] } })), tones),
    },
    {
      id: 'talk-tools', label: '말풍선', value: TOOL_TALK[s.speech.tools],
      draw: () => choiceList(el, 'talk-tools', table(TOOL_TALK, FORM_TOOL_TALK[form]), s.speech.tools, v => save(x => ({ ...x, speech: { ...x.speech, tools: v as HudSettings['speech']['tools'] } })), tones),
    },
    ...(form === 'small' && rows.length > 0 ? [{
      id: 'rows', label: '보일 줄', value: `${rows.filter(r => !s.hiddenRows.includes(r.id)).length}/${rows.length}`,
      draw: () => (
        <Box flexDirection="column">
          {rows.map(r => {
            const isShown = !s.hiddenRows.includes(r.id)
            return (
              <Box key={`row-${r.id}-line`}>
                <Button key={`row-${r.id}`} plain onPress={() => save(x => toggleRow(x, r.id))}>
                  <Text color={tones.accent}>{isShown ? PICKED_MARK : ' '}</Text>
                  <Text color={isShown ? tones.strong : tones.dim} bold={isShown}>{` ${r.label}`}</Text>
                </Button>
              </Box>
            )
          })}
        </Box>
      ),
    }] : []),
    ...withOptions.map(card => {
      const options = (card.options ?? []).filter(o => optionInForm(o, form))
      const values = optionValues(card, s)
      return {
        id: `card-${card.id}`, label: card.title, value: optionsSummary(options, values),
        draw: () => <Box flexDirection="column">{options.map(o => optionField($, el, card, o, values[o.key] ?? o.value, tones, form))}</Box>,
      }
    }),
  ]
}

/** 어느 모양이든 같은 설정 */
function layoutPages($: $, el: El, s: HudSettings, tones: Tones): Page[] {
  const save = (change: (s: HudSettings) => HudSettings) => void saveSettings($, change)
  return [
    { id: 'layout', label: '보일 곳', value: LAYOUTS[s.layout], draw: () => choiceList(el, 'layout', table(LAYOUTS), s.layout, v => save(x => ({ ...x, layout: v as HudSettings['layout'] })), tones) },
    { id: 'size-band', label: '입력창 위 크기', value: SIZES[s.size.band], draw: () => choiceList(el, 'size-band', table(SIZES), s.size.band, v => save(x => ({ ...x, size: { ...x.size, band: v as HudSettings['size']['band'] } })), tones) },
    { id: 'speed', label: '속도', value: SPEEDS[s.motion.speed], draw: () => choiceList(el, 'speed', table(SPEEDS), s.motion.speed, v => save(x => ({ ...x, motion: { ...x.motion, speed: v as HudSettings['motion']['speed'] } })), tones) },
    { id: 'sleep', label: '잠들기', value: SLEEPS[s.motion.sleep], draw: () => choiceList(el, 'sleep', table(SLEEPS), s.motion.sleep, v => save(x => ({ ...x, motion: { ...x.motion, sleep: v as HudSettings['motion']['sleep'] } })), tones) },
    { id: 'talk-react', label: '끝냄·경고 반응', value: REACT[s.speech.react], draw: () => choiceList(el, 'talk-react', table(REACT), s.speech.react, v => save(x => ({ ...x, speech: { ...x.speech, react: v as 'on' | 'off' } })), tones) },
  ]
}

/** 오래 걸린 답변이 끝났을 때 알림 */
function notifyPages($: $, el: El, s: HudSettings, tones: Tones): Page[] {
  const save = (change: (s: HudSettings) => HudSettings) => void saveSettings($, change)
  return [
    { id: 'notify-after', label: '끝남 알림', value: NOTIFY_AFTER[s.notify.after], draw: () => choiceList(el, 'notify-after', table(NOTIFY_AFTER), s.notify.after, v => save(x => ({ ...x, notify: { ...x.notify, after: v as HudSettings['notify']['after'] } })), tones) },
    { id: 'notify-sound', label: '알림 소리', value: SOUND[s.notify.sound], draw: () => choiceList(el, 'notify-sound', table(SOUND), s.notify.sound, v => save(x => ({ ...x, notify: { ...x.notify, sound: v as 'on' | 'off' } })), tones) },
  ]
}

async function rootPages($: $, el: El, s: HudSettings, tones: Tones): Promise<Page[]> {
  const list = ordered(await read($, cards), s)
  const shown = list.filter(c => !s.hidden.includes(c.id))
  return [
    { id: 'form', label: '모양', value: FORMS[s.form], items: await formPages($, el, s, tones, shown) },
    { id: 'layout', label: '배치', value: LAYOUTS[s.layout], items: layoutPages($, el, s, tones) },
    { id: 'notify', label: '알림', value: s.notify.after === 'off' ? NOTIFY_AFTER.off : SOUND[s.notify.sound] === SOUND.on ? '토스트 + 소리' : '토스트', items: notifyPages($, el, s, tones) },
    { id: 'theme', label: '테마', value: mem.themes[s.theme]?.name ?? s.theme, draw: () => themePage($, el, s, tones) },
    { id: 'cards', label: '카드', value: `${shown.length}/${list.length}개`, draw: () => cardsPage($, el, s, tones) },
  ]
}

/** 들어간 길을 따라 쪽을 찾는다. 없어진 쪽(모양을 바꿔 사라진 항목 등)에서 멈춘다 */
function trailOf(root: readonly Page[], path: readonly string[]): Page[] {
  const trail: Page[] = []
  let level: readonly Page[] = root
  for (const id of path) {
    const page = level.find(p => p.id === id)
    if (!page) break
    trail.push(page)
    if (!page.items) break
    level = page.items
  }
  return trail
}

/**
 * 목록(시안 1): 테두리 없는 줄 하나가 누르는 자리. 이름은 왼쪽, 지금 값과 › 는 흐리게 오른쪽 끝에 맞춘다.
 * 숫자 키로도 들어간다
 */
function menu(el: El, pages: readonly Page[], base: readonly string[], columns: number, go: (path: readonly string[]) => void, tones: Tones) {
  const { Box, Text, Button } = el
  const labelColumns = Math.max(...pages.map(p => cellWidth(p.label))) + MENU_GAP
  const valueRoom = Math.max(1, columns - labelColumns - cellWidth(MENU_ARROW))
  return (
    <Box flexDirection="column">
      {pages.map((p, i) => {
        const value = clip(p.value, valueRoom)
        const gap = Math.max(MENU_GAP, columns - cellWidth(p.label) - cellWidth(value) - cellWidth(MENU_ARROW))
        const id = [...base, p.id].join('.')
        return (
          <Box key={`go-${id}-line`}>
            <Button key={`go-${id}`} plain onPress={() => go([...base, p.id])}>
              <Text color={tones.text}>{p.label + ' '.repeat(gap)}</Text>
              <Text color={tones.dim}>{value + MENU_ARROW}</Text>
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

export async function drawSettings($: $, raw: El, tones: Tones, surface: string, columns: number) {
  // 모바일 표에도 Select 가 들어 있지만 그려지지 않아서, 화면 종류로 빼 버린다
  const el = (NO_PICKERS.has(surface) ? { ...raw, Select: undefined, Input: undefined } : raw) as El
  const { Box, Text, Button } = el
  const s = await read($, settings)
  const v = await read($, view)
  mem.isSettingsShown = true
  const root = await rootPages($, el, s, tones)
  const trail = trailOf(root, v.path ?? [])
  const ids = trail.map(p => p.id)
  const go = (path: readonly string[]) => void update($, view, x => ({ ...x, path }))
  const here = trail.at(-1)
  const body = !here ? menu(el, root, [], columns, go, tones) : here.items ? menu(el, here.items, ids, columns, go, tones) : await here.draw?.() ?? null
  // 맨 위 경로: 앞 칸은 강조색 글자 버튼(누르면 그 단계로 바로), 마지막 칸(지금 쪽)은 굵은 글자. 뒤로 줄 대신이다
  const names = [ROOT_LABEL, ...trail.map(p => p.label)]
  const crumbs = names.flatMap((name, d) => [
    ...(d > 0 ? [<Text key={`crumb-gap-${d}`} color={tones.dim}>{CRUMB_GAP}</Text>] : []),
    d === names.length - 1
      ? <Text key={`crumb-here-${d}`} bold color={tones.strong}>{name}</Text>
      : <Button key={`crumb-${d}`} plain onPress={() => go(ids.slice(0, d))}><Text color={tones.accent}>{name}</Text></Button>,
  ])
  const rule = (key: string) => <Text key={key} color={tones.line}>{'─'.repeat(Math.max(1, columns))}</Text>
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
        {/* 줄바꿈·줄어듦을 주면 터미널에서 이 줄이 0칸으로 접혀 안 보여서, 내용 폭 그대로의 한 줄로 둔다 */}
        <Box flexDirection="row" alignItems="center">{crumbs}</Box>
        {/* 초기화는 처음 목록에서만, 흐린 글자. 누른 뒤에는 같은 자리에 강조색 되돌리기 */}
        {here ? null : v.canUndo
          ? <Button key="undo" plain onPress={() => void undoReset($)}><Text color={tones.accent}>되돌리기</Text></Button>
          : <Button key="reset" plain onPress={() => void resetAll($)}><Text color={tones.dim}>초기화</Text></Button>}
      </Box>
      {rule('rule-top')}
      <Box flexDirection="column">{body}</Box>
      {rule('rule-bottom')}
    </Box>
  )
}
