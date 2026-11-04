// 에이전트 카드: 걸린 시간 표기와, 끝난 것이 잠깐 보였다 사라지는 규칙
import { expect, test } from 'claude-code/testing'

import type { AgentEntry } from '../types'
import { clockText, visible } from './register'

test('걸린 시간은 분:초, 한 시간이 넘으면 시:분:초', () => {
  expect(clockText(24_000)).toBe('0:24')
  expect(clockText(72_000)).toBe('1:12')
  expect(clockText(3_725_000)).toBe('1:02:05')
})

test('돌고 있는 것은 늘, 끝난 것은 10초 동안만 보인다', () => {
  const base = { name: '조사', kind: 'Explore', doing: '', startedAt: 0 }
  const list: AgentEntry[] = [
    { ...base, id: 'a', status: 'running' },
    { ...base, id: 'b', status: 'done', endedAt: 95_000 },
    { ...base, id: 'c', status: 'done', endedAt: 50_000 },
  ]
  expect(visible(list, 100_000).map(a => a.id)).toEqual(['a', 'b'])
})
