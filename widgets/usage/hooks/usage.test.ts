// 사용량 카드: 걸린 시간과 리셋까지 남은 시간 표기
import { expect, test } from 'claude-code/testing'

import { spanText, untilText } from './register'

const MIN = 60_000

test('걸린 시간: 짧으면 초까지, 길면 시간·분', () => {
  expect(spanText(42_000)).toBe('42초')
  expect(spanText(80_000)).toBe('1분 20초')
  expect(spanText(48 * MIN)).toBe('48분')
  expect(spanText(133 * MIN)).toBe('2시간 13분')
})

test('리셋까지 남은 시간', () => {
  const now = Date.parse('2026-11-04T12:00:00Z')
  expect(untilText('2026-11-04T12:13:00Z', now)).toBe('13분 뒤 리셋')
  expect(untilText('2026-11-04T14:13:00Z', now)).toBe('2시간 13분 뒤 리셋')
  expect(untilText('2026-11-05T17:00:00Z', now)).toBe('1일 5시간 뒤 리셋')
  expect(untilText('2026-11-08T12:00:00Z', now)).toBe('4일 뒤 리셋')
  expect(untilText('2026-11-04T11:00:00Z', now)).toBe('곧 리셋')
  expect(untilText(undefined, now)).toBe('')
})
