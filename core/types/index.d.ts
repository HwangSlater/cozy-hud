// cozy-hud 코어 계약: 부품·팩이 $.hud 로 보내는 데이터. 모두 순수 데이터(함수 없음).

/** 색 역할. 실제 색은 테마가 정한다. */
export type HudTone = 'text' | 'dim' | 'strong' | 'accent' | 'ok' | 'warn' | 'err'

/** 한 줄을 이루는 조각: 글자 · 게이지(0~1) · 작은 막대그래프 */
export type HudPiece =
  | { text: string; tone?: HudTone }
  | { gauge: number; width: number; tone?: HudTone }
  | { spark: readonly number[]; tone?: HudTone }

export type HudLine = readonly HudPiece[]

/** 부품 하나가 화면에 내는 카드 */
export type HudCard = {
  /** 부품 이름(배치·숨기기에 쓴다): 영문 소문자·숫자·- */
  id: string
  /** 패널에서 카드 위에 보이는 제목 */
  title: string
  /** 제목 줄 오른쪽 끝의 짧은 글(예: 3/5) */
  badge?: string
  /** 패널에 그릴 줄들 */
  lines: readonly HudLine[]
  /** 입력창 위 줄·상태줄에 쓸 한 줄 요약 */
  brief?: HudLine
}

/** 캐릭터 픽셀 그림. 글자 하나 = 픽셀 하나, '.' = 투명. 두 줄이 터미널 한 줄. */
export type HudCharacter = {
  id: string
  name: string
  /** 몸 색 글자(깜빡일 때 눈을 덮는 색) */
  body: string
  /** 눈이 있는 줄 번호 */
  eyes: readonly number[]
  rows: readonly string[]
  /** 일하는 동안 번갈아 보일 두 번째 프레임의 줄들 */
  alt: Readonly<Record<string, string>>
  /** 글자 → 색(#rrggbb) */
  colors: Readonly<Record<string, string>>
  /** 이 캐릭터와 어울리는 포인트 색(#rrggbb) */
  accent: string
}

/** 캐릭터가 잠깐 말하게 하기: cheer = 기뻐하며(뜀), warn = 걱정하며(땀) */
export type HudSay = { kind: 'cheer' | 'warn'; text: string }

export type HudAck = { isDone: true }

export type Hud = {
  put: (card: HudCard) => Promise<HudAck>
  drop: (args: { id: string }) => Promise<HudAck>
  characters: (args: { list: readonly HudCharacter[] }) => Promise<HudAck>
  say: (args: HudSay) => Promise<HudAck>
}

/** 사용자가 고른 값(세션이 바뀌어도 남음) */
export type HudLayout = 'pane' | 'band' | 'both'
export type HudSettings = {
  layout: HudLayout
  character: string
  theme: string
  /** 카드 순서(부품 id). 여기 없는 카드는 뒤에 붙는다 */
  order: readonly string[]
  hidden: readonly string[]
}

export type HudMood = 'idle' | 'work' | 'happy' | 'sweat' | 'sleep'
export type HudLive = {
  mood: HudMood
  speech: string
  /** 기분이 바뀐 시각(ms). 말풍선·뛰기 지속 시간을 잰다 */
  since: number
}

declare module 'claude-code' {
  interface EngineInterface {
    hud: Hud
  }
  interface PluginState {
    'cozy-hud': {
      cards: Shaped<Readonly<Record<string, HudCard>>>
      characters: Shaped<Readonly<Record<string, HudCharacter>>>
      settings: Shaped<HudSettings>
      live: Shaped<HudLive>
    }
  }
}
