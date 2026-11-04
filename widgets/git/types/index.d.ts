// git 부품: 상태를 따로 기억하지 않는다(답변이 끝날 때마다 git 에서 다시 읽음)

/** 설정 패널에서 고른 이 카드의 설정 값(코어가 hud.option 으로 알려 줌) */
export type CardOptions = Readonly<Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    'cozy-hud-git': { options: Shaped<CardOptions> }
  }
}
