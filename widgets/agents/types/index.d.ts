// 서브에이전트 부품: 띄운 에이전트마다 이름(할 일 설명)·종류·지금 하는 일·시작·끝 시각
export type AgentStatus = 'running' | 'done' | 'stopped' | 'idle'
export type AgentEntry = {
  id: string
  name: string
  kind: string
  doing: string
  startedAt: number
  endedAt?: number
  status: AgentStatus
}
export type AgentList = readonly AgentEntry[]

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-agents': { list: Shaped<AgentList> }
  }
}
