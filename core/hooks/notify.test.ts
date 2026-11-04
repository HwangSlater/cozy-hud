// 끝남 알림: 언제 알리는지, 걸린 시간을 어떻게 말하는지, 예전 설정에 없던 값
import { expect, test } from 'claude-code/testing'

import { shouldNotify, spokenDuration } from './notify'
import { DEFAULTS, fromStore } from './settings'

test('고른 시간보다 오래 걸린 답변만 알린다', () => {
  expect(shouldNotify('60', 59_000, false)).toBe(false)
  expect(shouldNotify('60', 60_000, false)).toBe(true)
  expect(shouldNotify('30', 45_000, false)).toBe(true)
})

test('끄기거나 사람이 멈춘 답변은 알리지 않는다', () => {
  expect(shouldNotify('off', 600_000, false)).toBe(false)
  expect(shouldNotify('30', 600_000, true)).toBe(false)
})

test('걸린 시간은 분·초로', () => {
  expect(spokenDuration(42_000)).toBe('42초')
  expect(spokenDuration(120_000)).toBe('2분')
  expect(spokenDuration(80_400)).toBe('1분 20초')
})

test('알림 설정이 없던 예전 저장 값은 기본값으로', () => {
  expect(fromStore({}).notify).toEqual(DEFAULTS.notify)
  expect(fromStore({ notify: { after: '180', sound: 'off' } }).notify).toEqual({ after: '180', sound: 'off' })
  expect(fromStore({ notify: { after: '7', sound: 'loud' } }).notify).toEqual(DEFAULTS.notify)
})
