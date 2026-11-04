// 오래 걸린 답변이 끝나면 알린다: 토스트 한 줄과(켰으면) 짧은 알림음.
import type { HudSettings } from '../types'
import type { $ } from './state'

/** 알림음 파일(코어 폴더 기준) */
const SOUND_FILE = 'sounds/done.wav'
/** Windows 에서 알림음을 틀 때 기다리는 최대 시간 */
const PLAY_TIMEOUT_MS = 5000
const SECOND = 1000

/** 알릴 만큼 오래 걸렸는지. after 가 off 면 알리지 않는다 */
export function shouldNotify(after: HudSettings['notify']['after'], durationMs: number, isAborted: boolean) {
  return after !== 'off' && !isAborted && durationMs >= Number(after) * SECOND
}

/** 「1분 20초」처럼 */
export function spokenDuration(ms: number) {
  const total = Math.round(ms / SECOND)
  const m = Math.floor(total / 60), sec = total % 60
  return m === 0 ? `${sec}초` : sec === 0 ? `${m}분` : `${m}분 ${sec}초`
}

/**
 * 엔진의 소리 재생은 Windows 터미널에서 아무것도 틀지 않아서, Windows 에서는 시스템 재생기로 직접 튼다.
 * 소리가 안 나도 일은 막지 않는다(까닭은 디버그 기록에만).
 */
async function playDone($: $) {
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  try {
    if (isWindows) {
      const path = `${$.plugin.root}/${SOUND_FILE}`.replaceAll('/', '\\').replaceAll("'", "''")
      await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer '${path}').PlaySync()`], { timeoutMs: PLAY_TIMEOUT_MS })
    } else await $.audio.play({ asset: SOUND_FILE })
  } catch (err) {
    $.ui.log(`cozy-hud: 알림음을 틀지 못했어요 — ${String(err)}`, { to: 'debug' })
  }
}

/** 답변 하나가 끝났을 때(메인 대화만) */
export async function notifyDone($: $, s: HudSettings, durationMs: number, isAborted: boolean) {
  if (!shouldNotify(s.notify.after, durationMs, isAborted)) return
  $.ui.toast(`답변이 끝났어요 · ${spokenDuration(durationMs)} 걸림`)
  if (s.notify.sound === 'on') void playDone($)
}
