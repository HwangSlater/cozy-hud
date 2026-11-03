# cozy-hud

Claude Code mod 모음. 계획·결정·교훈은 docs/(plan.md · decisions.md · lessons.md). 사용자 안내는 README 4개 언어판 — 내용을 바꾸면 넷 다 고친다.

- 구성: core/(필수, `$.hud` 를 더함: 그리기·배치·캐릭터·설정) + widgets/<이름>/(카드 하나씩, `dependencies: ["cozy-hud"]`). 마켓플레이스는 .claude-plugin/marketplace.json.
- 부품 → 코어는 이벤트라 순수 데이터만 넘긴다(카드 줄·색 역할). 색 값은 테마(core/themes.json)와 캐릭터 색표에만.
- 캐릭터 그림: core/data/characters.json. 글자 하나 = 픽셀 하나, `.` 투명, `~` 땀방울(색 글자로 쓰지 않음). 터미널은 색을 채널마다 16단계로 줄여 그리니 옅은 색은 0x11 배수로 고른다. 그림을 바꾸면 `python scripts/gallery.py` 로 docs/images/characters.png 를 다시 만든다.
- atom 은 쓰는 파일마다 같은 plugin·key·shape 로 다시 선언한다. `$` 를 받는 도우미는 파일 최상위 function 선언.
- 시험: 각 mod 폴더에서 `claude plugin test`, 검증: `claude plugin validate .`(저장소 루트와 mod 폴더 모두). 타입: `npx -p typescript tsc -p core --noEmit`.
- 화면 확인은 `orca terminal read --screen` 로 글자를 읽는다. 마우스·키보드 조작(orca computer)은 사용자 허락 없이 쓰지 않는다.
- UI 문구는 한국어, 시장 앱의 관행 용어.
