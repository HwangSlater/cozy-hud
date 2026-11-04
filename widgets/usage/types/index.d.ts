// 사용량 부품: 마지막 답변에 걸린 시간, 경고를 이미 했는지
export type UsageLast = { durationMs: number }
export type UsageWarned = boolean

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-usage': { last: Shaped<UsageLast>; hasWarned: UsageWarned; options: Shaped<CardOptions> }
  }
}
