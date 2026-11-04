// 사용자가 고른 값. 설정 패널과 /hud 명령이 바꾸고, 바뀐 값은 $.store 에 남는다.
import type { HudCard, HudCharacter, HudChoice, HudForm, HudLayout, HudNotifyAfter, HudOption, HudPaneSize, HudSettings, HudSize, HudSleep, HudSpeed, HudToolTalk } from '../types'

export const DEFAULTS: HudSettings = {
  form: 'medium', layout: 'both', character: 'claude', theme: 'auto', order: [], hidden: [], hiddenRows: [],
  size: { pane: 'medium', band: 'medium' },
  motion: { speed: 'normal', sleep: '15' },
  speech: { tools: 'file', react: 'on' },
  notify: { after: '60', sound: 'on' },
  petButton: 'on',
  today: 'off',
  cards: {},
}

/** 고를 수 있는 값과 화면에 보일 이름. 설정 패널의 목록도 여기서 만든다 */
export const LAYOUTS: Record<HudLayout, string> = { both: '패널 + 입력창 위', pane: '패널만', band: '입력창 위만' }
export const SIZES: Record<HudSize, string> = { large: '크게', medium: '보통', small: '작게' }
export const PANE_SIZES: Record<HudPaneSize, string> = { ...SIZES, none: '숨기기' }
export const FORMS: Record<HudForm, string> = { large: '크게', medium: '보통', small: '작게' }
/** 모양 버튼 아래 한 줄 설명 */
export const FORM_HINT: Record<HudForm, string> = {
  large: '넓은 패널용 · 카드 전부 + 세부 줄 · 50칸 이상',
  medium: '보통 패널용 · 카드 · 32~50칸',
  small: '좁은 패널용 · 카드마다 한 줄 · 22~32칸',
}
/** 모양마다 고를 수 있는 패널 캐릭터 크기·말풍선 */
export const FORM_PANE_SIZES: Record<HudForm, readonly HudPaneSize[]> = { large: ['large', 'medium'], medium: ['medium', 'small'], small: ['small', 'none'] }
export const FORM_TOOL_TALK: Record<HudForm, readonly HudToolTalk[]> = { large: ['file', 'verb', 'off'], medium: ['file', 'verb', 'off'], small: ['verb', 'off'] }
export const SPEEDS: Record<HudSpeed, string> = { fast: '빠르게', normal: '보통', slow: '느리게', off: '멈춤' }
export const SLEEPS: Record<HudSleep, string> = { '5': '5분', '15': '15분', '30': '30분', never: '안 잠듦' }
export const TOOL_TALK: Record<HudToolTalk, string> = { file: '파일 이름까지', verb: '하는 일만', off: '말 안 함' }
export const REACT: Record<'on' | 'off', string> = { on: '켜기', off: '끄기' }
export const NOTIFY_AFTER: Record<HudNotifyAfter, string> = { off: '끄기', '30': '30초 넘게 걸리면', '60': '1분 넘게 걸리면', '180': '3분 넘게 걸리면' }
export const SOUND: Record<'on' | 'off', string> = { on: '켜기', off: '끄기' }
export const SHOW: Record<'on' | 'off', string> = { on: '보이기', off: '숨기기' }

export type ThemeSpec = { name: string; tones: Record<string, string>; sweat: string }
export type Catalog = {
  themes: Readonly<Record<string, ThemeSpec>>
  characters: Readonly<Record<string, HudCharacter>>
  cards: Readonly<Record<string, HudCard>>
}

const pick = <T extends string>(table: Record<T, string>, v: unknown, fallback: T): T =>
  typeof v === 'string' && v in table ? (v as T) : fallback

/** allowed 에 없는 값이면 전체 순서(order)에서 가장 가까운 허용 값으로. 거리가 같으면 앞의 것 */
export function nearest<T extends string>(order: readonly T[], allowed: readonly T[], v: T): T {
  if (allowed.includes(v) || allowed.length === 0) return v
  const at = order.indexOf(v)
  return allowed.reduce((best, x) => (Math.abs(order.indexOf(x) - at) < Math.abs(order.indexOf(best) - at) ? x : best), allowed[0] as T)
}

/** 모양을 바꾼다. 캐릭터 크기·말풍선이 새 모양에 없으면 가장 가까운 값으로 */
export function applyForm(s: HudSettings, form: HudForm): HudSettings {
  return {
    ...s,
    form,
    size: { ...s.size, pane: nearest(Object.keys(PANE_SIZES) as HudPaneSize[], FORM_PANE_SIZES[form], s.size.pane) },
    speech: { ...s.speech, tools: nearest(Object.keys(TOOL_TALK) as HudToolTalk[], FORM_TOOL_TALK[form], s.speech.tools) },
  }
}

/** 이 모양에서 보일 카드 설정 항목인지 */
export const optionInForm = (o: { forms?: readonly HudForm[] }, form: HudForm) => !o.forms || o.forms.includes(form)
/** 이 모양에서 고를 수 있는 것만 */
export const choicesInForm = (choices: readonly HudChoice[], form: HudForm) => choices.filter(c => optionInForm(c, form))

/** 저장해 둔 값을 기본값과 합친다(모르는 칸·잘못된 값은 버림). 예전 형식도 읽는다 */
export function fromStore(raw: unknown): HudSettings {
  const v = (raw ?? {}) as Record<string, unknown>
  const obj = (x: unknown) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  const size = obj(v.size), motion = obj(v.motion), speech = obj(v.speech), notify = obj(v.notify)
  const cards: Record<string, Record<string, string>> = {}
  for (const [id, values] of Object.entries(obj(v.cards))) {
    cards[id] = Object.fromEntries(Object.entries(obj(values)).filter((e): e is [string, string] => typeof e[1] === 'string'))
  }
  const pane = pick(PANE_SIZES, size.pane, DEFAULTS.size.pane)
  // 모양이 없던 예전 설정은 패널 크기로 모양을 정한다(크게 고른 사람은 「크게」)
  const form = pick(FORMS, v.form, pane === 'large' ? 'large' : DEFAULTS.form)
  return applyForm({
    form,
    layout: pick(LAYOUTS, v.layout, DEFAULTS.layout),
    character: typeof v.character === 'string' ? v.character : DEFAULTS.character,
    theme: typeof v.theme === 'string' ? v.theme : DEFAULTS.theme,
    order: list(v.order),
    hidden: list(v.hidden),
    hiddenRows: list(v.hiddenRows),
    size: { pane, band: pick(SIZES, size.band, DEFAULTS.size.band) },
    motion: { speed: pick(SPEEDS, motion.speed, DEFAULTS.motion.speed), sleep: pick(SLEEPS, motion.sleep, DEFAULTS.motion.sleep) },
    speech: { tools: pick(TOOL_TALK, speech.tools, DEFAULTS.speech.tools), react: pick(REACT, speech.react, DEFAULTS.speech.react) },
    notify: { after: pick(NOTIFY_AFTER, notify.after, DEFAULTS.notify.after), sound: pick(SOUND, notify.sound, DEFAULTS.notify.sound) },
    petButton: pick(SHOW, v.petButton, DEFAULTS.petButton),
    today: pick(SHOW, v.today, DEFAULTS.today),
    cards,
  }, form)
}

/** 카드를 고른 순서대로(숨긴 것도 포함). 화면에 그릴 때는 visible 로 거른다 */
export function ordered(cards: Readonly<Record<string, HudCard>>, s: HudSettings): HudCard[] {
  const rank = (id: string) => {
    const i = s.order.indexOf(id)
    return i < 0 ? s.order.length : i
  }
  return Object.values(cards).sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
}
export const arrange = (cards: Readonly<Record<string, HudCard>>, s: HudSettings) =>
  ordered(cards, s).filter(c => !s.hidden.includes(c.id))

/** 카드 하나를 위(-1)나 아래(+1)로. 지금 보이는 순서를 그대로 order 에 적는다 */
export function moveCard(cards: Readonly<Record<string, HudCard>>, s: HudSettings, id: string, by: -1 | 1): HudSettings {
  const ids = ordered(cards, s).map(c => c.id)
  const i = ids.indexOf(id), j = i + by
  if (i < 0 || j < 0 || j >= ids.length) return s
  ;[ids[i], ids[j]] = [ids[j] as string, ids[i] as string]
  return { ...s, order: ids }
}

const toggled = (list: readonly string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])
export const toggleHidden = (s: HudSettings, id: string): HudSettings => ({ ...s, hidden: toggled(s.hidden, id) })
/** 「작게」 모양의 줄 하나를 숨기거나 보이기(row = 「카드id.줄key」) */
export const toggleRow = (s: HudSettings, row: string): HudSettings => ({ ...s, hiddenRows: toggled(s.hiddenRows, row) })

/** 카드 설정 값: 부품이 정한 기본값 위에 사용자가 고른 값. 지금 모양에서 고를 수 없는 값은 가장 가까운 값으로 */
export function optionValues(card: HudCard, s: HudSettings): Record<string, string> {
  const chosen = s.cards[card.id] ?? {}
  return Object.fromEntries((card.options ?? []).map((o: HudOption) => {
    const v = chosen[o.key] ?? o.value
    if (o.kind !== 'choice') return [o.key, v]
    return [o.key, nearest(o.choices.map(c => c.value), choicesInForm(o.choices, s.form).map(c => c.value), v)]
  }))
}

export const setOption = (s: HudSettings, card: string, key: string, value: string): HudSettings =>
  ({ ...s, cards: { ...s.cards, [card]: { ...(s.cards[card] ?? {}), [key]: value } } })

export const HELP = [
  '/hud                         설정 패널 열기',
  '/hud layout pane|band|both   어디에 보일지',
  '/hud character <이름>|none   캐릭터 바꾸기(이름 없이 쓰면 목록)',
  '/hud theme <이름>            테마 바꾸기(이름 없이 쓰면 목록)',
  '/hud form large|medium|small HUD 모양(크게 · 보통 · 작게)',
  '/hud reset                   초기화',
].join('\n')

/** 명령 하나를 적용한 새 설정과 보여 줄 글. 설정이 안 바뀌면 next 는 null. 빈 명령은 패널이 맡는다 */
export function runCommand(args: string, s: HudSettings, c: Catalog): { next: HudSettings | null; text: string } {
  // 안내 문구의 [ ] < > 를 그대로 따라 쳐도 알아듣게 벗긴다
  const words = args.replace(/[[\]<>]/g, ' ').trim().split(/\s+/).filter(Boolean)
  const [verb = '', ...rest] = words
  const arg = rest.join(' ')
  const keep = (text: string) => ({ next: null, text })
  const set = (next: HudSettings, text: string) => ({ next, text })

  switch (verb) {
    case 'layout':
      return arg in LAYOUTS
        ? set({ ...s, layout: arg as HudLayout }, `배치를 「${LAYOUTS[arg as HudLayout]}」(으)로 바꿨어요.`)
        : keep(`배치는 pane · band · both 중 하나예요. 지금: ${s.layout}`)
    case 'character': {
      const names = Object.values(c.characters).map(ch => `${ch.id}(${ch.name})`)
      if (!arg) return keep(`캐릭터: none, ${names.join(', ') || '— 캐릭터 팩을 설치하세요'}`)
      if (arg !== 'none' && !c.characters[arg]) return keep(`「${arg}」 캐릭터가 없어요. 쓸 수 있는 것: none, ${names.join(', ')}`)
      return set({ ...s, character: arg }, arg === 'none' ? '캐릭터를 숨겼어요.' : `캐릭터를 「${c.characters[arg]?.name}」(으)로 바꿨어요.`)
    }
    case 'theme': {
      const names = Object.entries(c.themes).map(([id, t]) => `${id} — ${t.name}`)
      if (!arg) return keep(names.join('\n'))
      if (!c.themes[arg]) return keep(`「${arg}」 테마가 없어요.\n${names.join('\n')}`)
      return set({ ...s, theme: arg }, `테마를 「${c.themes[arg]?.name}」(으)로 바꿨어요.`)
    }
    case 'form':
      return arg in FORMS
        ? set(applyForm(s, arg as HudForm), `모양을 「${FORMS[arg as HudForm]}」(으)로 바꿨어요.`)
        : keep(`모양은 large · medium · small 중 하나예요. 지금: ${s.form}`)
    case 'reset':
      return set(DEFAULTS, '초기화했어요.')
    default:
      return keep(`모르는 명령이에요: ${verb}\n\n${HELP}`)
  }
}
