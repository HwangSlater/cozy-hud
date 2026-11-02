# 계획

> 최종 수정: 2026-11-02 · cozy-hud 진행 계획과 지금 상태

## 무엇을 만드나
Claude Code mod 모음 저장소 **cozy-hud**(공개). 하나의 mod 가 아니라, 코어 위에 부품과 꾸미기 팩을 골라 끼우고 언제든 바꿀 수 있게 한다.

```
cozy-hud/                       저장소 = 마켓플레이스 (.claude-plugin/marketplace.json)
├─ core/          필수. $.hud 를 더한다: 패널·입력창 위 줄을 그리는 틀, 테마·캐릭터 엔진,
│                 기분(평소/일함/끝/경고/잠) 계산, 배치·테마 고르기 명령(/hud …), 고른 값 저장($.store)
├─ widgets/<이름>/ 부품. core 에 dependencies 로 기대고, 자기 칸만 등록한다(그리기·배치는 core)
└─ packs/<이름>/   꾸미기 팩. 캐릭터 픽셀·팔레트 데이터만, 코드 거의 없음
```

## 1단계 범위
- [ ] core: 패널 + 입력창 위 줄, 칸 등록 API, 테마·캐릭터 적용, `/hud` 명령(배치·테마·캐릭터 고르기), 고른 값 유지
- [ ] widgets/tokens: 이번 답변·세션 토큰, 답변별 막대
- [ ] widgets/context: 컨텍스트 게이지, 압축 임박 경고
- [ ] widgets/checklist: 세션 체크리스트(`~/.claude/checklists/<세션>.md`) 실시간
- [ ] packs/characters: 시안 3차 캐릭터(동물 8 + 말랑 친구 3), 클로드 포함
- [ ] 마켓플레이스 파일 · README 설치 안내 · `claude plugin validate`·`test` 통과
- [ ] 공개 저장소 `HwangSlater/cozy-hud` 로 올리기

## 다음 단계 후보
도구 기록 · 바뀐 파일 · 7일 레포 알림 · 오늘 할 일·메모 · 집중 타이머 · 위험 명령 기록 · 답변 끝 알림 · 배치 프리셋(시안 2차 A 동료 / B 관제실 / C 하루 플래너 / D 작업 흐름).


## 참고
- 시안: `C:\Users\doorc\Downloads\make-mods-시안\` (1차 레이아웃 · 2차 기능 조합·테마 · 3차 캐릭터)
- 시안 공개 페이지: https://hwangslater.github.io/make-mods-mockups/

## 바뀐 이력
- 2026-11-02: 처음 작성.
- 2026-11-02: 남은 결정 정리(클로드 포함, 작성자 noreply).
