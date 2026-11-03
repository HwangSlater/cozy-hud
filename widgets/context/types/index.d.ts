// 컨텍스트 부품: 경고를 이미 했는지(같은 고비에서 두 번 말하지 않게)
export type ContextWarned = boolean

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-context': { hasWarned: ContextWarned; options: Shaped<CardOptions> }
  }
}
