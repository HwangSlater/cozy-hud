// 사용자가 고른 값과 /hud 명령. 명령은 고른 값을 바꾸고, 바뀐 값은 $.store 에 남는다.
import type { HudCard, HudCharacter, HudLayout, HudSettings } from '../types'

export const DEFAULTS: HudSettings = { layout: 'both', character: 'claude', theme: 'auto', order: [], hidden: [] }
const LAYOUTS: Record<HudLayout, string> = { pane: '패널만', band: '입력창 위 줄만', both: '패널 + 입력창 위 줄' }

export type ThemeSpec = { name: string; tones: Record<string, string>; sweat: string }
export type Catalog = {
  themes: Readonly<Record<string, ThemeSpec>>
  characters: Readonly<Record<string, HudCharacter>>
  cards: Readonly<Record<string, HudCard>>
}

/** 저장해 둔 값을 기본값과 합친다(모르는 칸·잘못된 값은 버림) */
export function fromStore(raw: unknown): HudSettings {
  const v = (raw ?? {}) as Partial<HudSettings>
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  return {
    layout: v.layout && v.layout in LAYOUTS ? v.layout : DEFAULTS.layout,
    character: typeof v.character === 'string' ? v.character : DEFAULTS.character,
    theme: typeof v.theme === 'string' ? v.theme : DEFAULTS.theme,
    order: list(v.order),
    hidden: list(v.hidden),
  }
}

/** 카드를 고른 순서대로, 숨긴 것은 빼고 */
export function arrange(cards: Readonly<Record<string, HudCard>>, s: HudSettings): HudCard[] {
  const visible = Object.values(cards).filter(c => !s.hidden.includes(c.id))
  const rank = (id: string) => {
    const i = s.order.indexOf(id)
    return i < 0 ? s.order.length : i
  }
  return visible.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
}

export const HELP = [
  '/hud                     패널 열기 · 지금 설정 보기',
  '/hud layout pane|band|both   어디에 보일지',
  '/hud character <이름>|none   캐릭터 바꾸기(이름 없이 쓰면 목록)',
  '/hud theme <이름>         테마 바꾸기(이름 없이 쓰면 목록)',
  '/hud order a,b,c          카드 순서',
  '/hud hide <카드> · /hud show <카드>',
  '/hud reset                처음 설정으로',
].join('\n')

function summary(s: HudSettings, c: Catalog): string {
  const ch = s.character === 'none' ? '없음' : c.characters[s.character]?.name ?? `${s.character}(설치 안 됨)`
  const cards = Object.keys(c.cards)
  return [
    `배치: ${LAYOUTS[s.layout]} · 캐릭터: ${ch} · 테마: ${c.themes[s.theme]?.name ?? s.theme}`,
    `카드: ${cards.length ? cards.map(id => (s.hidden.includes(id) ? `${id}(숨김)` : id)).join(', ') : '없음 — 부품 mod 를 설치하세요'}`,
    '',
    HELP,
  ].join('\n')
}

/** 명령 하나를 적용한 새 설정과 보여 줄 글. 설정이 안 바뀌면 next 는 null */
export function runCommand(args: string, s: HudSettings, c: Catalog): { next: HudSettings | null; text: string } {
  const [verb = '', ...rest] = args.trim().split(/\s+/).filter(Boolean)
  const arg = rest.join(' ')
  const keep = (text: string) => ({ next: null, text })
  const set = (next: HudSettings, text: string) => ({ next, text })

  switch (verb) {
    case '':
      return keep(summary(s, c))
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
    case 'order': {
      const order = arg.split(/[,\s]+/).filter(Boolean)
      return order.length ? set({ ...s, order }, `카드 순서: ${order.join(' → ')}`) : keep('예: /hud order tokens,context,checklist')
    }
    case 'hide':
    case 'show': {
      if (!arg) return keep(`예: /hud ${verb} tokens`)
      const hidden = s.hidden.filter(id => id !== arg)
      return verb === 'hide'
        ? set({ ...s, hidden: [...hidden, arg] }, `「${arg}」 카드를 숨겼어요. 다시 보려면 /hud show ${arg}`)
        : set({ ...s, hidden }, `「${arg}」 카드를 다시 보여요.`)
    }
    case 'reset':
      return set(DEFAULTS, '처음 설정으로 되돌렸어요.')
    default:
      return keep(`모르는 명령이에요: ${verb}\n\n${HELP}`)
  }
}
