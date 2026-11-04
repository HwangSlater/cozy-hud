// 도구 기록 부품: 최근에 쓴 도구(최근 것이 앞), 지금까지 쓴 횟수
export type ToolStatus = 'running' | 'ok' | 'failed'
export type ToolEntry = { id: string; tool: string; target: string; at: number; status: ToolStatus }
export type ToolLog = { entries: readonly ToolEntry[]; count: number }

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-tools': { log: Shaped<ToolLog>; options: Shaped<CardOptions> }
  }
}
