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

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-tokens': { tally: Shaped<TokensTally> }
  }
}
