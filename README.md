<div align="center">

# cozy-hud

### 터미널 옆에 작은 동료를

Claude Code 옆에 픽셀 캐릭터와 계기판을 붙이는 mod 모음.<br>
Claude가 일하면 같이 움직이고, 끝내면 뛰고, 지치면 땀을 흘려요.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)](#바로-시작하기)
![Characters](https://img.shields.io/badge/characters-14-f2a0a0.svg)
[![Local only](https://img.shields.io/badge/data-stays%20local-555.svg)](#내-데이터는-내-컴퓨터에)

**한국어** · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

<img src="docs/images/demo-work.gif" alt="Claude가 shop.py 버그를 고치는 동안 움직이는 HUD. 말풍선이 하는 일을 알려 주고, 답변이 끝나면 토큰·컨텍스트 카드가 채워진다" width="820">

<sub>Claude가 버그를 고치는 동안(3배속). 말풍선이 하는 일을 알려 주고, 답변이 끝나면 토큰·컨텍스트 카드가 채워져요.</sub>

</div>

---

## 기다리는 시간이 조금 덜 심심하게

Claude에게 일을 맡기고 나면 화면은 글자만 쌓여요. 지금 뭘 하는지, 얼마나 썼는지, 컨텍스트가 얼마나 남았는지 한눈에 보기 어려워요.

**cozy-hud**는 터미널 옆 패널과 입력창 위 한 줄에 작은 캐릭터와 계기판을 붙여요.

- 캐릭터는 Claude가 일하는 동안 발을 움직이고, 할 일을 끝내면 뛰고, 컨텍스트가 80%를 넘으면 땀을 흘리고, 오래 쉬면 잠들어요.
- 도구를 쓸 때마다 말풍선으로 무엇을 하는지 알려 줘요. 「register.tsx 읽는 중」처럼요.
- 토큰, 컨텍스트, 할 일 같은 계기판은 필요한 것만 골라 설치해요. 어떤 조합이든 같은 디자인으로 보여요.

## 바로 시작하기

Claude Code에서 한 번만 설치하세요.

```
/plugin marketplace add HwangSlater/cozy-hud
/plugin install cozy-hud@cozy-hud
```

계기판도 원하는 것만 더하세요.

```
/plugin install cozy-hud-tokens@cozy-hud
/plugin install cozy-hud-context@cozy-hud
/plugin install cozy-hud-checklist@cozy-hud
```

설치하면 「HUD」와 「HUD 설정」 두 탭이 열려요. 끝이에요.

**필요 조건** · mod를 지원하는 Claude Code(2.1.287 이상) · 터미널과 데스크톱 앱에서 그려져요(`claude -p`·원격 세션에서는 안 보여요) · 패널 폭 22칸 이상, 「크게」 모양은 50칸 이상 · 네트워크는 쓰지 않아요

## 들어 있는 것

| mod | 하는 일 |
| --- | --- |
| `cozy-hud` | 코어(필수). 패널과 입력창 위 줄, 설정 패널, 캐릭터 14종 |
| `cozy-hud-tokens` | 이번 답변과 세션 전체의 토큰 사용량, 답변별 막대그래프 |
| `cozy-hud-context` | 컨텍스트 사용률 게이지. 경고 시작 %를 고를 수 있어요 |
| `cozy-hud-checklist` | Claude의 할 일 목록을 실시간으로. 세션 체크리스트 파일(`~/.claude/checklists/<세션>.md`)이 있으면 자동으로 따라가고, 다른 마크다운 파일을 지정할 수도 있어요 |

캐릭터는 클로드, 고양이, 펭귄, 병아리, 토끼, 여우, 북극여우, 강아지, 개구리, 곰, 판다, 햄스터, 찹쌀떡, 호빵이에요.

<div align="center"><img src="docs/images/characters.png" alt="cozy-hud 캐릭터 14종" width="760"></div>

## 바꾸기

「HUD 설정」 탭에서 마우스나 키보드로 바꿔요. 맨 위 미리보기는 늘 보이고, 그 아래 목록에서 「모양 › 캐릭터」처럼 들어가 골라요. 맨 위 경로(「설정 › 모양 › 캐릭터」)의 앞 칸을 누르면 그 단계로 바로 돌아가요. 바꾼 값은 세션이 바뀌어도 남아요.

<div align="center">
<img src="docs/images/demo-settings.gif" alt="HUD 설정 탭에서 캐릭터를 넘기고 모양을 크게·보통·작게로 바꾸면 위 미리보기가 바로 바뀌는 화면" width="400">

<sub>키보드로 조작한 화면이에요. 마우스로 눌러도 똑같아요.</sub>
</div>

| 목록 | 고르는 것 |
| --- | --- |
| 모양 | HUD 모양(크게·보통·작게)과 그 모양에서 쓰는 설정만: 캐릭터 크기, 말풍선, 카드별 설정 |
| 배치 | 보일 곳(패널·입력창 위), 입력창 위 크기, 움직임 속도, 잠드는 시간, 끝냄·경고 반응 |
| 알림 | 오래 걸린 답변이 끝나면 알림(끄기·30초·1분·3분 넘게), 알림 소리 |
| 테마 | 자동 · 기본 · 호박 · 민트 · 흑백 |
| 카드 | 카드 보임·숨김, 순서 |

모양은 패널 폭에 맞춰 고르세요. **크게**(50칸 이상)는 카드에 세부 줄까지, **보통**은 지금 모양, **작게**(22~32칸)는 카드마다 한 줄로 줄이고 보일 줄을 하나씩 켜고 끌 수 있어요.

<table align="center">
<tr><th>크게</th><th>보통</th><th>작게</th></tr>
<tr><td valign="top"><img src="docs/images/form-large.png" alt="크게: 넓은 패널 · 세부 줄까지" width="260"><br><sub>넓은 패널 · 세부 줄까지</sub></td><td valign="top"><img src="docs/images/form-medium.png" alt="보통: 보통 패널 · 카드" width="260"><br><sub>보통 패널 · 카드</sub></td><td valign="top"><img src="docs/images/form-small.png" alt="작게: 좁은 패널 · 카드마다 한 줄" width="260"><br><sub>좁은 패널 · 카드마다 한 줄</sub></td></tr>
</table>

캐릭터는 미리보기 아래 `[ < ]` `[ > ]`로 넘기거나, 이름을 눌러 전체 목록에서 골라요.

키보드: `Ctrl+X` 다음 `Tab`으로 설정 탭에 들어가면 `Tab` 다음 칸 · `Enter` 고르기 · `A`/`D` 캐릭터 넘기기 · `Esc` 나가기.

바로 바꾸는 명령도 있어요.

```
/hud                    설정 탭 열기
/hud character cat      캐릭터 바꾸기
/hud theme mint         테마 바꾸기
/hud layout pane        패널에만 보이기
/hud form small         HUD 모양 바꾸기(large·medium·small)
/hud reset              초기화
```

## 내 데이터는 내 컴퓨터에

cozy-hud는 네트워크를 쓰지 않아요. Claude Code가 이미 가진 정보(토큰 사용량, 컨텍스트, 도구 이름, 할 일 목록)를 화면에 그릴 뿐이에요. 고른 설정은 Claude Code의 mod 저장소에만 남아요.

## 캐릭터·계기판 만들기

다른 mod가 `dependencies: ["cozy-hud"]`로 코어에 기대어 캐릭터나 카드를 더할 수 있어요.

- 캐릭터: `$.hud.characters({ list })`로 픽셀 글자 그림과 색표를 넘겨요. 형식은 [core/data/characters.json](core/data/characters.json)을 보세요. 글자 하나가 픽셀 하나이고 `.`은 투명, `~`은 땀방울 자리라 색 글자로 쓰지 않아요.
- 카드: `$.hud.put({ id, title, lines, brief })`로 보내요. 색은 직접 고르지 않고 `dim`·`ok`·`warn` 같은 역할만 적어요. 형식은 [core/types/index.d.ts](core/types/index.d.ts)에 있어요.
- 코어가 다시 불러와지면 `hud.ready`를 보내니, `session.start`와 `hud.ready` 둘 다에서 보내면 돼요.

## 라이선스

[MIT](LICENSE) © [HwangSlater](https://github.com/HwangSlater). 클로드 캐릭터는 Anthropic의 마스코트를 본뜬 팬아트예요.
