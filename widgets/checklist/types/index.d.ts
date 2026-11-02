// 체크리스트 부품의 항목
export type ChecklistStatus = 'pending' | 'in_progress' | 'completed'
export type ChecklistItem = { id: string; text: string; status: ChecklistStatus }

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-checklist': { items: Shaped<readonly ChecklistItem[]> }
  }
}
