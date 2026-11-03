// 토큰 부품이 세션 동안 쌓는 값
export type TokensTally = {
  output: number
  input: number
  cacheRead: number
  /** 답변별 출력 토큰(최근 것만) */
  history: readonly number[]
  last: number
  isRunning: boolean
}

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-tokens': { tally: Shaped<TokensTally>; options: Shaped<CardOptions> }
  }
}
