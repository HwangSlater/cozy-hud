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
  /** 「크게」 모양에서만 lines 아래에 더 보일 세부 줄 */
  detail?: readonly HudLine[]
  /** 「작게」 모양에서 카드 대신 보일 이름 · 값 줄들. 없으면 제목 · brief 한 줄 */
  compact?: readonly HudRow[]
  /** 설정 패널 「카드」 탭에 보일 이 카드의 설정 항목. 고른 값은 hud.option 으로 돌아온다 */
  options?: readonly HudOption[]
}

/** 「작게」 모양의 한 줄: 이름(코어가 칸을 맞춤) · 값. key 는 카드 안에서 줄을 숨길 때 쓴다 */
export type HudRow = { key: string; label: string; value: HudLine }

/** HUD 모양: 크게(넓은 패널) · 보통 · 작게(좁은 패널) */
export type HudForm = 'large' | 'medium' | 'small'

/**
 * 카드 설정 항목 하나. value 는 기본값. 값은 모두 글자로 오간다.
 * forms: 이 항목을 보일 모양(없으면 모두). 고를 것에도 forms 를 달면 그 모양에서만 보이고,
 * 지금 모양에 없는 값은 코어가 가장 가까운 값으로 바꿔 알려 준다.
 */
export type HudOption =
  | { key: string; label: string; kind: 'choice'; choices: readonly HudChoice[]; value: string; forms?: readonly HudForm[] }
  | { key: string; label: string; kind: 'text'; placeholder?: string; value: string; forms?: readonly HudForm[] }
export type HudChoice = { value: string; label: string; forms?: readonly HudForm[] }

/** 코어가 부품에게 알리는 카드 설정 값(기본값에 사용자가 고른 값을 덮은 것) */
export type HudOptionValues = { card: string; values: Readonly<Record<string, string>> }

/** 그림 한 벌: 줄 · 두 번째 프레임 · 눈 줄 */
export type HudSprite = {
  /** 눈이 있는 줄 번호(깜빡일 때 몸 색으로 덮음) */
  eyes: readonly number[]
  rows: readonly string[]
  /** 일하는 동안 번갈아 보일 두 번째 프레임의 줄들 */
  alt: Readonly<Record<string, string>>
}
export type HudSize = 'small' | 'medium' | 'large'

/** 캐릭터 픽셀 그림. 글자 하나 = 픽셀 하나, '.' = 투명, '~' 는 땀방울로 쓰니 색 글자로 쓰지 않는다. 두 줄이 터미널 한 줄. 기본 그림이 「보통」 크기 */
export type HudCharacter = HudSprite & {
  id: string
  name: string
  /** 몸 색 글자(깜빡일 때 눈을 덮는 색) */
  body: string
  /** 다른 크기 그림(선택). 없으면 크게는 기본 그림을 두 배로, 작게는 기본 그림을 쓴다 */
  sizes?: Readonly<Partial<Record<'small' | 'large', HudSprite>>>
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
  /** 코어가 부르고 부품이 듣는다: 카드 설정 값이 정해지거나 바뀌었을 때 */
  option: (args: HudOptionValues) => Promise<HudAck>
  /** 코어가 부르고 팩·부품이 듣는다: 코어가 (다시) 불러와졌으니 캐릭터·카드를 다시 보내 달라 */
  ready: (args: Record<string, never>) => Promise<HudAck>
}

/** 사용자가 고른 값(세션이 바뀌어도 남음) */
export type HudLayout = 'pane' | 'band' | 'both'
export type HudSpeed = 'off' | 'slow' | 'normal' | 'fast'
/** 잠드는 시간(분). never = 잠들지 않음 */
export type HudSleep = 'never' | '5' | '15' | '30'
/** 답변이 이만큼(초) 넘게 걸렸을 때만 끝남 알림. off = 알리지 않음 */
export type HudNotifyAfter = 'off' | '30' | '60' | '180'
/** 도구를 쓸 때 말풍선: 파일 이름까지 · 동작만 · 끔 */
export type HudToolTalk = 'file' | 'verb' | 'off'
/** 패널 캐릭터 크기. none = 패널에는 캐릭터를 그리지 않음(「작게」 모양) */
export type HudPaneSize = HudSize | 'none'
export type HudSettings = {
  /** HUD 모양. 모양마다 고를 수 있는 캐릭터 크기·말풍선·카드 설정이 다르다 */
  form: HudForm
  layout: HudLayout
  character: string
  theme: string
  /** 카드 순서(부품 id). 여기 없는 카드는 뒤에 붙는다 */
  order: readonly string[]
  hidden: readonly string[]
  /** 「작게」 모양에서 숨긴 줄: 「카드id.줄key」 */
  hiddenRows: readonly string[]
  size: { pane: HudPaneSize; band: HudSize }
  motion: { speed: HudSpeed; sleep: HudSleep }
  speech: { tools: HudToolTalk; react: 'on' | 'off' }
  /** 오래 걸린 답변이 끝나면 알림(토스트, 소리) */
  notify: { after: HudNotifyAfter; sound: 'on' | 'off' }
  /** 카드별 설정 값: 카드 id → 항목 key → 값 */
  cards: Readonly<Record<string, Readonly<Record<string, string>>>>
}

/**
 * 설정 패널에서 보고 있는 쪽(저장하지 않음). path: 처음 목록에서 들어간 길(예: ['form', 'size-pane'] = 설정 › 모양 › 캐릭터).
 * canUndo: 「초기화」 직후 되돌리기 단추를 보일지. picking: 미리보기에서 캐릭터 이름 격자를 펼쳤는지
 */
export type HudView = { path: readonly string[]; canUndo: boolean; picking?: boolean }

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
      view: Shaped<HudView>
    }
  }
}
