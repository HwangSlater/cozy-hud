// git 카드: git status 읽기
import { expect, test } from 'claude-code/testing'

import { parseStatus } from './register'

test('브랜치·앞선 커밋·바뀐 파일을 읽는다', () => {
  const s = parseStatus('## master...origin/main [ahead 2, behind 1]\n M core/hooks/notify.ts\nA  core/sounds/done.wav\n?? widgets/git/\n')
  expect(s.branch).toBe('master')
  expect(s.ahead).toBe(2)
  expect(s.behind).toBe(1)
  expect(s.files.map(f => f.path)).toEqual(['core/hooks/notify.ts', 'core/sounds/done.wav', 'widgets/git/'])
  expect(s.files.map(f => f.code)).toEqual(['M', 'A', '??'])
})

test('원격이 없는 브랜치와 커밋이 아직 없는 저장소', () => {
  expect(parseStatus('## feature\n').branch).toBe('feature')
  expect(parseStatus('## No commits yet on main\n?? a.txt\n').branch).toBe('main')
  expect(parseStatus('## HEAD (no branch)\n').branch).toBe('(분리된 HEAD)')
})

test('깨끗하면 바뀐 파일이 없다', () => {
  const s = parseStatus('## master...origin/master\n')
  expect(s.files).toEqual([])
  expect(s.ahead).toBe(0)
})
