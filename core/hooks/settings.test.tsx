// 설정 패널: 버튼·목록으로 고른 값이 저장되는지(부품에 전해지는 것은 실제 세션에서 확인)
import { expect, mock, test } from 'claude-code/testing'

import type { HudCharacter } from '../types'

// 시험에는 $.hud 가 없어서, 코어가 캐릭터·카드 값을 읽을 때 시험이 대신 답한다(shape 는 코어와 같게)
const SEEDED: Record<string, { shape: string; value: unknown }> = {
  characters: { shape: 'characters-2', value: {} },
  cards: { shape: 'cards-1', value: {} },
}

const THEMES = JSON.stringify({
  auto: { name: '자동', tones: { text: 'text', dim: 'inactive', strong: 'text', accent: '@character', ok: 'success', warn: 'warning', err: 'error', line: 'subtle' }, sweat: '#6fb7ff' },
  mint: { name: '민트', tones: { text: '#c3cbcf', dim: '#66727a', strong: '#e8eef0', accent: '#5bb8a6', ok: '#8cc47e', warn: '#e6b450', err: '#e06c6c', line: '#2f383e' }, sweat: '#6fb7ff' },
})

const dot = (id: string, name: string): HudCharacter => ({
  id, name, body: 'W', eyes: [0], rows: ['WK', 'WW'], alt: {}, colors: { W: '#ffffff', K: '#000000' }, accent: '#ff8800',
})

const SETTINGS_PANE = {
  plugin: 'cozy-hud',
  component: 'Pane',
  requestId: 'cozy-hud-settings',
  props: { title: 'HUD 설정', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type Stored = { character?: string; theme?: string; hidden?: string[]; cards?: Record<string, Record<string, string>> }

type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>

async function start($: Parameters<Body>[0], on: Parameters<Body>[1]) {
  const saved: Stored[] = []
  mock.clock(on)
  const characters = { mochi: dot('mochi', '찹쌀떡'), bun: dot('bun', '호빵') }
  const cards = {
    context: {
      id: 'context', title: '컨텍스트', lines: [],
      options: [{ key: 'warn', label: '경고 시작', kind: 'choice', value: '80', choices: [{ value: '70', label: '70%' }, { value: '90', label: '90%' }] }],
    },
  }
  const seeded: Record<string, unknown> = { characters, cards }
  on('state.get', (_, e, next) => {
    const seed = e.plugin === 'cozy-hud' ? SEEDED[e.key] : undefined
    return seed ? { value: { value: { shape: seed.shape, value: seeded[e.key] }, version: 1 } } : next(e)
  })
  // 코어가 읽는 파일: 테마와 기본 캐릭터
  on('fs.read', (_, e) => ({ value: e.path.endsWith('themes.json') ? THEMES : '[]' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', (_, e) => {
    saved.push(e.value as Stored)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'hud' } }))
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  // 열린 탭 목록: 시험이 연 탭을 그대로 돌려준다
  on('ui.panes', () => ({ value: opened.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return { saved, opened }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`◀ ▶ 로 넘기면 저장된다 (${surface})`, async ($, on) => {
    const { saved } = await start($, on)
    const ui = await $.ui.mount({ ...SETTINGS_PANE, surface })
    // 고른 캐릭터(claude)가 목록에 없으면 첫 캐릭터(mochi)에서 시작한다
    await ui.press({ key: 'ch-next' })
    expect(saved.at(-1)?.character).toBe('bun')
    await ui.press({ key: 'ch-prev' })
    expect(saved.at(-1)?.character).toBe('mochi')
    await ui.unmount()
  })

  test(`카드 설정·숨기기를 고르면 저장된다 (${surface})`, async ($, on) => {
    const { saved } = await start($, on)
    const ui = await $.ui.mount({ ...SETTINGS_PANE, surface })
    await ui.press({ key: 'tab-cards' })
    await ui.press({ key: 'opt-context-warn-90' })
    expect(saved.at(-1)?.cards?.context?.warn).toBe('90')
    await ui.press({ key: 'vis-context' })
    expect(saved.at(-1)?.hidden).toEqual(['context'])
    await ui.unmount()
  })

  test(`처음 설정으로 되돌린 뒤 되돌리기 (${surface})`, async ($, on) => {
    const { saved } = await start($, on)
    const ui = await $.ui.mount({ ...SETTINGS_PANE, surface })
    await ui.press({ key: 'character' })
    await ui.press({ key: 'pick-mochi' })
    await ui.press({ key: 'reset' })
    expect(saved.at(-1)?.character).toBe('claude')
    expect(await ui.find({ type: 'Button', key: 'undo' })).toBeDefined()
    await ui.press({ key: 'undo' })
    expect(saved.at(-1)?.character).toBe('mochi')
    await ui.unmount()
  })
}

test('목록이 없는 화면(모바일)에서는 버튼 줄로 고른다', async ($, on) => {
  const { saved } = await start($, on)
  const ui = await $.ui.mount({ ...SETTINGS_PANE, surface: 'mobile' })
  await ui.press({ key: 'speed-slow' })
  expect((saved.at(-1) as { motion?: { speed?: string } })?.motion?.speed).toBe('slow')
  await ui.unmount()
})

test('/hud 를 이름 없이 치면 설정 패널을 연다', async ($, on) => {
  const { opened } = await start($, on)
  const r = await $.command.run({ command: 'hud', args: '' } as Parameters<typeof $.command.run>[0])
  expect(opened).toContain('cozy-hud-settings')
  expect(r.text).toContain('설정 패널')
})

test('설정 패널 아래에 HUD 미리보기가 같이 그려지고, 탭에는 숫자 단축키가 있다', async ($, on) => {
  await start($, on)
  const ui = await $.ui.mount({ ...SETTINGS_PANE, surface: 'terminal' })
  // 시험의 캐릭터 목록에는 기본 캐릭터가 없어서 하나를 고른다
  await ui.press({ key: 'character' })
    await ui.press({ key: 'pick-mochi' })
  expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  const tab = await ui.find({ type: 'Button', key: 'tab-theme' })
  expect((tab as { props?: { hotkey?: string } } | undefined)?.props?.hotkey).toBe('3')
  await ui.unmount()
})

test('세션이 시작되면 HUD 와 HUD 설정 탭을 같이 연다', async ($, on) => {
  const { opened } = await start($, on)
  // 탭 열기는 세션 시작을 붙잡지 않으려고 기다리지 않아서, 끝날 때까지 몇 번 돌린다
  for (let i = 0; i < 20 && opened.length < 2; i++) await Promise.resolve()
  expect(opened).toEqual(['cozy-hud-settings', 'cozy-hud'])
})

test('미리보기의 넘기기 줄에서 < > 와 이름 목록으로 캐릭터를 고른다', async ($, on) => {
  const { saved } = await start($, on)
  const ui = await $.ui.mount({ ...SETTINGS_PANE, surface: 'terminal' })
  await ui.press({ key: 'character' })
    await ui.press({ key: 'pick-mochi' })
  expect(saved.at(-1)?.character).toBe('mochi')
  expect(await ui.find({ type: 'Raster', key: 'pet' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'ch-next' })).toBeDefined()
  await ui.unmount()
})

test('고를 것이 적은 항목은 버튼 한 번으로 고르고, < > 는 A/D 로도 누른다', async ($, on) => {
  const { saved } = await start($, on)
  const ui = await $.ui.mount({ ...SETTINGS_PANE, surface: 'terminal' })
  await ui.press({ key: 'size-pane-small' })
  expect((saved.at(-1) as { size?: { pane?: string } })?.size?.pane).toBe('small')
  const next = await ui.find({ type: 'Button', key: 'ch-next' })
  const prev = await ui.find({ type: 'Button', key: 'ch-prev' })
  expect((next as { props?: { hotkey?: string } } | undefined)?.props?.hotkey).toBe('d')
  expect((prev as { props?: { hotkey?: string } } | undefined)?.props?.hotkey).toBe('a')
  await ui.unmount()
})

test('이름 버튼으로 캐릭터 격자를 펼치고, 고르거나 다시 누르면 닫힌다', async ($, on) => {
  const { saved } = await start($, on)
  const ui = await $.ui.mount({ ...SETTINGS_PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'pick-bun' })).toBeUndefined()
  await ui.press({ key: 'character' })
  expect(await ui.find({ type: 'Button', key: 'pick-bun' })).toBeDefined()
  await ui.press({ key: 'character' })
  expect(await ui.find({ type: 'Button', key: 'pick-bun' })).toBeUndefined()
  await ui.press({ key: 'character' })
  await ui.press({ key: 'pick-bun' })
  expect(saved.at(-1)?.character).toBe('bun')
  expect(await ui.find({ type: 'Button', key: 'pick-bun' })).toBeUndefined()
  await ui.unmount()
})
