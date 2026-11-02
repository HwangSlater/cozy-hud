// 캐릭터 팩: data/characters.json 을 코어에 넘긴다. 그림 데이터만 있고 그리기는 코어가 한다.
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const list = JSON.parse(await $.fs.read(`${$.plugin.root}/data/characters.json`))
    await $.hud.characters({ list })
    return next(e)
  })
}
