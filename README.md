# cozy-hud

Claude Code 터미널 옆에 작은 캐릭터와 계기판을 붙이는 mod 모음입니다. 코어 하나에 캐릭터 16종이 들어 있고, 필요한 부품만 골라 설치합니다. 캐릭터·크기·움직임·배치·테마·카드 설정은 `/hud` 로 여는 설정 패널에서 바꿉니다.

- 캐릭터는 일하는 동안 움직이고, 할 일을 끝내면 뛰고, 컨텍스트가 80%를 넘으면 땀을 흘리고, 오래 쉬면 잠듭니다.
- 부품은 카드 하나씩을 보내고, 그리기와 배치는 코어가 맡아서 어떤 조합이든 같은 디자인으로 보입니다.

## 설치

Claude Code 프롬프트에서 코어와 원하는 것을 설치합니다(처음 한 번 `y` 로 마켓플레이스 추가).

```
/plugin install cozy-hud --marketplace HwangSlater/cozy-hud
/plugin install cozy-hud-tokens --marketplace HwangSlater/cozy-hud
/plugin install cozy-hud-context --marketplace HwangSlater/cozy-hud
/plugin install cozy-hud-checklist --marketplace HwangSlater/cozy-hud
```

셸에서는 `claude plugin install <이름> --marketplace HwangSlater/cozy-hud` 입니다.

## 들어 있는 것

| mod | 하는 일 |
|---|---|
| `cozy-hud` | 코어(필수). 패널과 입력창 위 줄, 설정 패널. 캐릭터 16종 포함: 클로드, 고양이·펭귄·병아리·토끼·여우·북극여우·강아지·개구리·곰·햄스터·문어·고래, 찹쌀떡·콩떡·호빵 |
| `cozy-hud-tokens` | 이번 답변·세션 토큰, 답변별 막대그래프 |
| `cozy-hud-context` | 컨텍스트 사용률 게이지, 80% 넘으면 캐릭터가 알려 줌 |
| `cozy-hud-checklist` | 할 일 목록(TodoWrite·작업 도구). 설정에서 마크다운 체크리스트 파일을 지정할 수도 있음 |

## 바꾸기

`/hud` 를 치면 설정 패널이 열립니다(Esc 로 닫기).

| 탭 | 고르는 것 |
|---|---|
| 캐릭터 | 캐릭터, 크기(패널·입력창 위 따로), 움직임 속도, 잠드는 시간 |
| 배치·말풍선 | 보일 곳, 도구를 쓸 때 말풍선, 끝냄·경고 반응 |
| 테마 | 자동 · 기본 · 호박 · 민트 · 흑백 |
| 카드 | 카드 보임·숨김, 순서, 카드별 설정(경고 %, 막대그래프 개수, 체크리스트 파일 등) |

바로 바꾸는 명령도 있습니다: `/hud character cat`, `/hud theme mint`, `/hud layout pane`, `/hud reset`.

## 캐릭터 팩 만들기

다른 mod 가 `$.hud.characters({ list })` 로 캐릭터를 더할 수 있습니다(`dependencies: ["cozy-hud"]`). 코어가 다시 불러와지면 `hud.ready` 를 보내니, 팩은 `session.start` 와 `hud.ready` 둘 다에서 보내면 됩니다. 크기별 그림은 `sizes: { small, large }` 에 넣습니다.

고른 값은 세션이 바뀌어도 남습니다. 기본 테마 `auto` 는 터미널 색을 그대로 쓰고 포인트 색만 캐릭터를 따라갑니다.

## 부품·캐릭터 만들기

부품은 `$.hud.put({ id, title, lines, brief })` 로 카드를 보내는 작은 mod 입니다. 색은 직접 고르지 않고 `dim`·`ok`·`warn` 같은 역할만 적습니다. 형식은 [core/types/index.d.ts](core/types/index.d.ts) 에 있습니다. 캐릭터는 픽셀 글자 그림(가로 12~18칸 × 세로 8~10픽셀)과 색표를 `$.hud.characters({ list })` 로 넘깁니다 — [core/data/characters.json](core/data/characters.json) 참고.

## 라이선스

MIT © HwangSlater. 클로드 캐릭터는 Anthropic 의 마스코트를 본뜬 팬아트입니다.
