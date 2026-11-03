// 움직임: 그림이 같으면 칸을 다시 끼우지 않고, 잠들거나 멈춤이면 타이머가 없다
import { expect, mock, test } from 'claude-code/testing'

import type { HudCharacter } from '../types'

const THEMES = JSON.stringify({ auto: { name: '자동', tones: {}, sweat: '#6fb7ff' } })
// 일할 때 두 번째 프레임에서 아랫줄이 바뀌는 2×2 캐릭터
const DOT: HudCharacter = {
  id: 'claude', name: '클로드', body: 'W', eyes: [0], rows: ['WK', 'WW'], alt: { 1: 'W.' },
  colors: { W: '#ffffff', K: '#000000' }, accent: '#ff8800',
}
const PANE = {
  plugin: 'cozy-hud', component: 'Pane', requestId: 'cozy-hud', surface: 'terminal',
  props: { title: 'HUD', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>

async function start($: Parameters<Body>[0], on: Parameters<Body>[1], speed = 'normal') {
  const clock = mock.clock(on)
  const blits: string[] = []
  const reads = { count: 0 }
  on('state.get', (_, e, next) => {
    reads.count++
    return next(e)
  })
  on('fs.read', (_, e) => ({ value: e.path.endsWith('themes.json') ? THEMES : JSON.stringify([DOT]) }))
  on('store.get', () => ({ value: { motion: { speed, sleep: '15' } } }))
  on('store.set', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', (_, e) => {
    blits.push(e.requestId)
    return { value: {} }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({}) as never)
  on('session.usage', () => ({ value: { context: { percent: 10, tokens: 0, window: 1 } } }) as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PANE)
  return { clock, blits, ui, reads }
}

test('가만히 있을 때는 눈 깜빡임 말고는 칸을 끼우지 않는다', async ($, on) => {
  const { clock, blits, ui, reads } = await start($, on)
  const readsBefore = reads.count
  await clock.advance(250 * 10)
  expect(blits).toHaveLength(0)
  // 타이머는 엔진에 값을 묻지 않는다(사본을 읽음)
  expect(reads.count - readsBefore).toBe(0)
  await clock.advance(250 * 10)
  // 20번째 프레임에 한 번 감고, 다음 프레임에 다시 뜬다
  expect(blits.length).toBeLessThanOrEqual(2)
  await ui.unmount()
})

test('일하는 동안은 프레임마다 바뀐다', async ($, on) => {
  const { clock, blits, ui } = await start($, on)
  await $.turn.start({ turnId: 't1' } as Parameters<typeof $.turn.start>[0])
  const before = blits.length
  await clock.advance(250 * 4)
  expect(blits.length - before).toBeGreaterThanOrEqual(3)
  await ui.unmount()
})

test('멈춤이면 일하는 중에도 끼우지 않는다', async ($, on) => {
  const { clock, blits, ui } = await start($, on, 'off')
  await $.turn.start({ turnId: 't1' } as Parameters<typeof $.turn.start>[0])
  await clock.advance(250 * 8)
  expect(blits).toHaveLength(0)
  await ui.unmount()
})
