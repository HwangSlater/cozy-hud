// 컨텍스트 부품: 경고를 이미 했는지(같은 고비에서 두 번 말하지 않게)
export type ContextWarned = boolean

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-context': { hasWarned: ContextWarned }
  }
}
