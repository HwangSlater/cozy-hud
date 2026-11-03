// 체크리스트 부품의 항목
export type ChecklistStatus = 'pending' | 'in_progress' | 'completed'
export type ChecklistItem = { id: string; text: string; status: ChecklistStatus }

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-checklist': { items: Shaped<readonly ChecklistItem[]>; options: Shaped<CardOptions> }
  }
}
