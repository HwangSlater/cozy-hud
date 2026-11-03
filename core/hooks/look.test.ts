// 픽셀 색: 캐릭터 색 글자가 땀방울 색으로 칠해지지 않는다(곰·토끼 몸 글자 'B' 가 땀색으로 칠해지던 일)
import { expect, test } from 'claude-code/testing'

import type { HudCharacter } from '../types'
import { colorOf, frameRows, spriteOf } from './look'

const SWEAT_COLOR = '#6fb7ff'
// 몸 글자가 'B' 인 2×2 캐릭터(곰과 같은 글자)
const BEAR: HudCharacter = {
  id: 'bear', name: '곰', body: 'B', eyes: [0], rows: ['BK', 'BB'], alt: {},
  colors: { B: '#9a6a45', K: '#1a1714' }, accent: '#9a6a45',
}

test('그림에 쓴 글자는 자기 색표의 색으로 칠한다', () => {
  const paint = colorOf(BEAR, SWEAT_COLOR)
  expect(paint('B')).toBe('#9a6a45')
  expect(paint('K')).toBe('#1a1714')
})

test('땀 흘릴 때 땀방울 칸만 땀 색이다', () => {
  const paint = colorOf(BEAR, SWEAT_COLOR)
  const cells = frameRows(BEAR, 'medium', 'sweat', 0).join('').split('')
  expect(cells.filter(px => paint(px) === SWEAT_COLOR).length).toBe(1)
})

test('크게는 따로 그린 그림이 없으면 두 배로 그린다(눈 줄·일하는 줄도 같이)', () => {
  const big = spriteOf({ ...BEAR, alt: { 1: 'B.' } }, 'large')
  expect(big.rows).toEqual(['BBKK', 'BBKK', 'BBBB', 'BBBB'])
  expect(big.eyes).toEqual([0, 1])
  expect(big.alt).toEqual({ 2: 'BB..', 3: 'BB..' })
  expect(spriteOf(BEAR, 'medium').rows).toEqual(BEAR.rows)
  expect(spriteOf(BEAR, 'small').rows).toEqual(BEAR.rows)
})
