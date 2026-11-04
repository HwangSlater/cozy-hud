// 도구 기록 카드: 보여 줄 대상과 「몇 초 전」 표기
import { expect, test } from 'claude-code/testing'

import { agoText, targetOf } from './register'

test('대상은 파일 이름, 명령 첫 줄, 찾는 말 순서로', () => {
  expect(targetOf({ file_path: 'C:\\repo\\core\\hooks\\register.tsx' })).toBe('register.tsx')
  expect(targetOf({ command: 'npm test\necho done' })).toBe('npm test')
  expect(targetOf({ pattern: 'notifyDone' })).toBe('"notifyDone"')
  expect(targetOf({})).toBe('')
})

test('긴 대상은 줄여서 끝에 말줄임', () => {
  const t = targetOf({ command: 'npx -p typescript tsc -p core --noEmit --pretty false' })
  expect([...t].length).toBe(28)
  expect(t.endsWith('…')).toBe(true)
})

test('몇 초 전', () => {
  expect(agoText(1000)).toBe('방금')
  expect(agoText(12_000)).toBe('12초 전')
  expect(agoText(180_000)).toBe('3분 전')
  expect(agoText(3_700_000)).toBe('1시간 전')
})
