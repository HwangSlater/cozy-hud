// 「오늘」 기록: 날이 바뀔 때, 이어서 쓴 날, 같은 파일 두 번 세지 않기
import { expect, test } from 'claude-code/testing'

import { addFile, dayOf, rollOver, workText, type Today } from './today'

const DAY = 24 * 60 * 60_000
const noon = new Date(2026, 10, 4, 12, 0, 0).getTime()

test('처음이면 오늘부터 1일째', () => {
  const t = rollOver(undefined, noon)
  expect(t.date).toBe('2026-11-04')
  expect(t.streak).toBe(1)
  expect(t.answers).toBe(0)
})

test('같은 날이면 그대로, 다음 날이면 새로 세고 이어서 쓴 날 +1, 하루를 건너뛰면 1일째부터', () => {
  const t: Today = { ...rollOver(undefined, noon), answers: 5, streak: 3 }
  expect(rollOver(t, noon + 60_000)).toBe(t)
  const next = rollOver(t, noon + DAY)
  expect(next.date).toBe(dayOf(noon + DAY))
  expect(next.answers).toBe(0)
  expect(next.streak).toBe(4)
  expect(rollOver(t, noon + 2 * DAY).streak).toBe(1)
})

test('같은 파일은 한 번만 센다', () => {
  let t = rollOver(undefined, noon)
  t = addFile(t, 'a.ts')
  t = addFile(t, 'a.ts')
  t = addFile(t, 'b.ts')
  expect(t.fileCount).toBe(2)
})

test('일한 시간', () => {
  expect(workText(48 * 60_000)).toBe('48분')
  expect(workText(130 * 60_000)).toBe('2시간 10분')
})
