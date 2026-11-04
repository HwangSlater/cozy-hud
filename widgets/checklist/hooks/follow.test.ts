// 할 일 카드가 파일을 따라갈지, Claude의 할 일 도구를 따라갈지
import { expect, test } from 'claude-code/testing'

import { followsFile } from './register'

test('사람이 적은 파일은 없어도 파일을 따라간다(카드에 못 찾았다고 알림)', () => {
  expect(followsFile({ path: 'C:/a.md', isAuto: false, mtime: -2 })).toBe(true)
})

test('자동으로 찾는 세션 체크리스트 파일은 찾았을 때만 따라간다', () => {
  expect(followsFile({ path: 'C:/s.md', isAuto: true, mtime: -1 })).toBe(false)
  expect(followsFile({ path: 'C:/s.md', isAuto: true, mtime: -2 })).toBe(false)
  expect(followsFile({ path: 'C:/s.md', isAuto: true, mtime: 1730000000000 })).toBe(true)
})

test('경로가 없으면 할 일 도구를 따라간다', () => {
  expect(followsFile({ path: '', isAuto: false, mtime: -1 })).toBe(false)
})
