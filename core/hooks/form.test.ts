// HUD 모양: 예전 설정 읽기, 가까운 값 고르기, 좁은 패널에서 줄 맞추기
import { expect, test } from 'claude-code/testing'

import type { HudCard } from '../types'
import { clipLine, fitLine, rowsOf } from './draw'
import { DEFAULTS, applyForm, fromStore, nearest, optionValues } from './settings'

test('모양이 없던 예전 설정은 패널 크기로 모양을 정한다', () => {
  expect(fromStore({ size: { pane: 'large' } }).form).toBe('large')
  expect(fromStore({ size: { pane: 'small' } }).form).toBe('medium')
  expect(fromStore({}).form).toBe(DEFAULTS.form)
})

test('저장된 값이 모양과 맞지 않으면 읽을 때 맞춘다', () => {
  const s = fromStore({ form: 'small', size: { pane: 'large' }, speech: { tools: 'file' } })
  expect(s.size.pane).toBe('small')
  expect(s.speech.tools).toBe('verb')
})

test('없는 값은 전체 순서에서 가장 가까운 허용 값으로', () => {
  expect(nearest(['large', 'medium', 'small', 'none'], ['small', 'none'], 'large')).toBe('small')
  expect(nearest(['large', 'medium', 'small', 'none'], ['medium', 'small'], 'none')).toBe('small')
  expect(nearest(['a', 'b'], ['a', 'b'], 'b')).toBe('b')
})

test('모양을 바꿔도 캐릭터·테마·카드 순서는 그대로', () => {
  const before = { ...DEFAULTS, character: 'bun', theme: 'mint', order: ['tokens'] }
  const after = applyForm(before, 'small')
  expect(after.character).toBe('bun')
  expect(after.theme).toBe('mint')
  expect(after.order).toEqual(['tokens'])
})

test('카드 설정 값: 지금 모양에서 고를 수 없는 값은 가까운 값으로 알린다', () => {
  const card: HudCard = {
    id: 'tokens', title: '토큰', lines: [],
    options: [{ key: 'bars', label: '막대', kind: 'choice', value: '24', choices: [{ value: '12', label: '12' }, { value: '24', label: '24' }, { value: '48', label: '48', forms: ['large'] }] }],
  }
  const chosen = { ...DEFAULTS, cards: { tokens: { bars: '48' } } }
  expect(optionValues(card, { ...chosen, form: 'large' }).bars).toBe('48')
  expect(optionValues(card, { ...chosen, form: 'medium' }).bars).toBe('24')
})

test('좁으면 게이지는 폭을 줄이고 막대그래프는 최근 것만 남긴다', () => {
  const gauge = fitLine([{ gauge: 0.5, width: 24 }, { text: ' 8%' }], 12)
  expect(gauge[0]).toEqual({ gauge: 0.5, width: 9 })
  const spark = fitLine([{ text: '답변별 ' }, { spark: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }], 11)
  expect(spark[1]).toEqual({ spark: [7, 8, 9, 10] })
  // 넓으면 그대로
  expect(fitLine([{ gauge: 0.5, width: 8 }], 40)[0]).toEqual({ gauge: 0.5, width: 8 })
})

test('작게 모양의 줄: compact 가 없으면 제목 · 한 줄 요약', () => {
  expect(rowsOf({ id: 'x', title: '엑스', lines: [], brief: [{ text: '3' }] })).toEqual([{ key: 'brief', label: '엑스', value: [{ text: '3' }] }])
  expect(rowsOf({ id: 'x', title: '엑스', lines: [] })).toEqual([])
})

test('칸을 넘는 글자는 미리 자르고, 가운뎃점처럼 폭이 애매한 글자는 두 칸으로 센다', () => {
  const line = [{ text: '30/34', tone: 'strong' as const }, { text: ' 새 카드(시간·비용)' }]
  const clipped = clipLine(line, 16)
  const width = clipped.reduce((sum, p) => sum + [...('text' in p ? p.text : '')].reduce((w, ch) => w + (/[가-힣·…]/.test(ch) ? 2 : 1), 0), 0)
  expect(width).toBeLessThanOrEqual(16)
  expect(clipped.at(-1) && 'text' in clipped.at(-1)! ? (clipped.at(-1) as { text: string }).text.endsWith('…') : false).toBe(true)
  expect(clipLine(line, 40)).toEqual(line)
})
