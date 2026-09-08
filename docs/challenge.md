# Challenge 규칙과 검증

2026-09-09 로컬 구현. Playground 보존과 30초 / 60초, Ghost Race, 테마 콤보, 개인 기록의 네 가지 범위.

## 판정의 기준

`RaceEngine`은 전달받은 단조 시각만 사용하며 DOM, renderer, interval과 Date 참조 없음. UI의 50ms interval은 상태 갱신 요청만 담당. 시작 시각 + 3,000ms부터 경기, 시작 시각 + 3,000ms + 제한 시간 이상에서는 입력보다 종료 판정을 먼저 수행. 따라서 마지막 UI 갱신 사이에 도착한 마감 이후 입력도 결과 제외.

텍스트는 NFC 정규화 후 `Intl.Segmenter` grapheme으로 분리. 지문과 동일한 접두사까지만 진행하며 첫 오타 뒤 문자는 진행에 포함하지 않는 방식. 선택 편집, 삭제와 재입력은 native textarea에서 처리. 마지막으로 확정한 텍스트와의 변경 부분에서 새로 삽입되거나 교체된 오타를 누적. 삭제 자체와 기존 오타가 남아 있는 상태의 중복 알림은 새 오타 제외.

현재 정확한 접두사 길이는 순속도에 사용. 이전 최대 도달 위치는 정답 고유 위치 수로 별도 유지. 삭제 후 재입력한 과거 위치는 콤보, 정답 보상과 정확도 분모를 추가하지 않는 구조. 오타 발생 시 콤보 0, 삭제만으로 오타 이력 초기화 없음. 단순 삭제는 콤보 보상을 발생시키지 않으며 콤보 유지.

| 지표 | 정의 |
| --- | --- |
| 영어와 코드 WPM | 현재 정확한 문자 수 ÷ 5 ÷ 경과 분 |
| 한국어 CPM | 현재 정확한 완성 문자 수 ÷ 경과 분 |
| 정확도 | 정답으로 통과한 고유 위치 수 ÷ (고유 위치 수 + 누적 오타 수) × 100 |
| 콤보 단계 | 10, 25, 50개의 연속으로 새롭게 통과한 위치 |
| 개인 최고 | 동일 조건에서 최종 속도 우선, 속도 같으면 정확도 우선. 0자 기록은 최고 제외 |

공백과 줄바꿈 포함, 속도에 콤보 배수 없음. 종료 결과의 경과 시간은 정확히 30,000ms 또는 60,000ms. 정답 입력이 없는 경기의 결과도 완료 이력으로 저장 가능하지만 개인 최고로 등록하지 않는 정책.

## 입력과 모션의 분리

기존 `KeyboardInput`과 공통 가상 키 편집 함수를 양쪽 모드에서 재사용. 물리 키와 다중 포인터, 키 travel과 사운드는 기존 경로 유지. Challenge의 정답 판정은 키 누름 횟수가 아니라 native input과 조합 확정값에서 계산.

소프트웨어 입력처럼 물리 code 없이 확정된 정답은 키보드 중앙의 작은 판정 효과 사용. 가상의 물리 키 누름이나 입력음은 생성하지 않는 경계.

`CompositionGate`는 조합 중 값의 판정을 미루고 compositionend와 뒤따르는 최종 input의 동일 값을 한 번만 전달. 조합 취소로 원래 값에 돌아오면 새 판정 없음. 경기 종료에 걸친 미확정 조합은 제외. `beforeinput`의 붙여넣기, 드롭과 undo 차단에 더해 비취소성 input이 도착하면 마지막 확정 값으로 복구. 이는 브라우저 내 정상 사용을 위한 제한이며 개발 도구의 직접 조작 방어는 아님.

`ChallengeChannel`은 정답, 오타, 콤보 변경, 경기 종료와 reset을 테마로 전달. 3D 쪽에는 속도와 정확도 계산 없음. 게임의 입력 샘플링은 그대로 두고 시각 보상만 기본 35ms / 약하게 75ms 간격으로 제한. 14개 테마에 소재별 particle, ribbon과 wave 재사용. 기본 입자 64개 / 낮은 품질 24개, ribbon 6개 / 3개, wave 3개 상한. 경기 중 큰 대표 동작 차단, 종료에 한 번만 실행. 끄기와 모션 감소에서도 동일한 판정과 저장 경로 사용.

결과 화면에서 재도전할 때는 사라졌던 editor를 동기적으로 다시 붙인 뒤 같은 클릭 안에서 포커스. 새로운 입력창에도 beforeinput 차단을 다시 연결하는 구조. 모바일 실제 소프트웨어 키보드 활성화는 별도 기기 검증 필요.

## 저장과 재생

localStorage의 `keyspace:challenge:v1`에 다음 항목만 저장.

- 기록 ID와 생성 시각.
- 지문 ID, 지문 버전, 언어, 종류, 30 / 60초와 판정 규칙 `correct-prefix-v1`.
- 완료 결과와 `[실제 경과 ms, 정확한 위치]` 배열.

Playground 문장, Challenge 오타 원문, 키 입력 코드와 사운드 설정은 저장하지 않는 구조. 최근 20회 + 조건별 최고 기록, 현재 3개 지문 × 2개 시간에서 최대 26개. 데이터 읽기 시 허용 필드만 재구성하며 지문 조건, 숫자 범위, 유한성, 속도와 정확도 재계산, 진행 시각 정렬과 시작 및 종료 표본 확인.

Ghost는 현재 시각 이하의 마지막 저장 위치를 그대로 표시. 선형 보간과 평균 속도 추정 없음. 입력이 없으면 정지, 삭제 시 후퇴. 과밀 입력은 10ms 버킷에서 마지막으로 실제 관찰한 시각과 위치만 유지. 시작과 끝 포함 60초당 6,002개 상한. 일반적인 타이핑보다 충분히 조밀하지만 10ms 안의 모든 중간 궤적까지 보존하는 것은 아닌 절충.

읽기 실패, 손상 자료와 쓰기 실패를 빈 정상 기록과 구분. 결과는 현재 화면 유지, 저장 재시도 제공. 손상된 기존 저장소에 대한 자동 덮어쓰기 없음. 전체 기록 삭제는 명시 확인 후 이 키만 제거, 실패 시 UI 이력 유지. 브라우저 데이터 삭제와 장치 변경에는 기록 보존 보장 없음. 탭 숨김과 pagehide 중단은 완료 결과와 Ghost 미저장.

## 검증 근거

### 자동 검증 완료

- TypeScript 검사와 Vitest 54개. 신규 판정, 조합, 기록과 세션 검사 29개 포함. 렌더링 없이 경계 시각, 2,000회 삭제 재입력, 오타 이력, 60초 CPM, 콤보 무배수, 밀집 이력, 기록 변조, 읽기 / 쓰기 / 삭제 실패와 재시도 검사.
- `tests/e2e/challenge.spec.ts` 13개 통과. Chromium native 영어 입력, 빠른 연속 타이핑, 같은 키의 repeat, 선택과 사운드 보존, Challenge 전용 paste / drop / undo 차단, 코드 줄바꿈과 기호, 60초 결과 검사.
- Chrome DevTools Protocol `Input.imeSetComposition`과 `Input.insertText`로 `ㅈ → 자 → 작 → 확정`, 다음 음절, 취소와 중복 최종 input 검사. 중간 오타 0, 확정 문자 1회 반영, 종료 시 미확정 조합 제외 확인. 운영체제의 실제 한글 입력기 검사와 구분.
- 실제 완료 이력 저장 후 reload, Ghost 선택, 긴 휴지와 삭제에 의한 후퇴 및 같은 시점의 차이 확인. 60초와 코드로 변경 시 호환 Ghost 선택 제외 확인.
- Storage API 차단으로 read 실패, quota 형태의 write 실패와 복구 후 동일 ID 저장 확인. 삭제는 UI 확인 후 수행하며 다른 저장소 키 보존 확인.
- visibility 상태와 이벤트를 재현하여 즉시 취소, 장시간 시계 전진 후에도 완료와 최고 기록 저장 없음 확인. 실제 OS 창 전환을 수동 수행한 검사는 아님.
- 14개 테마에서 새로운 55자 정답, 3단계 콤보, 잘못된 Enter와 Space의 큰 연출 미발생, 동일 최종 점수와 단일 피날레 확인. Orbit의 안정된 고리, 효과 끄기와 모션 감소의 점수 동일성 확인.
- 1440×900, 1024×768, 768×1024, 390×844, 844×390, 320×740에서 Challenge 가로 넘침, 키보드 경계, 설정, 종료와 기록 확장 시 footer 비중첩 검사. 작은 화면은 필요한 세로 스크롤 허용.

브라우저 경계 시각과 긴 경기 재현은 Playwright 가상 단조 시계 사용. 실제 경과 시간 부하 검사는 `scripts/measure-challenge.mjs`로 분리. 최신 실행 산출물은 `artifacts/challenge/`와 `playwright-report/`.

전체 기존 회귀를 포함한 Playwright 58개, 약 4.4분 실행 통과. 기존 60초 / 1,800회 합성 타건 및 140회 테마 전환 검사도 포함.

### 실제 시간과 리소스 검사

가짜 시계 없이 Inferno, 기본 콤보 효과, 1440×900 / DPR 2에서 30초 경기를 완료. 자동화한 native 입력 917자, 오타 0, 저장 결과의 경과 시간 30,000ms, 약 59.95fps 확인. 이는 사용자의 타이핑 기록이 아닌 격리된 테스트 브라우저의 부하 입력. 실행 시작을 UI의 running 확인 뒤에 잡으므로 관찰 구간은 약 29.69초이며 경기 자체의 제한 시간과는 구분.

Playground와 Challenge 20회 왕복에서 Challenge 밖의 보상 객체 없음, 워밍업 후 geometry, texture와 프로그램 수 동일 확인. GPU 메모리 바이트나 JavaScript heap 전수 분석은 아닌 범위. 원본은 `artifacts/challenge/performance.json`.

### 미확인 범위

- macOS / Windows의 실제 한국어 입력기, 후보 선택과 운영체제별 특수 조합 순서.
- 실제 iOS / Android 소프트웨어 키보드, 입력창 활성화, visualViewport와 발열 상황.
- WebKit과 Firefox의 조합 및 storage 이벤트 차이.
- 동시 여러 탭에서 기록을 갱신할 때의 원자적 트랜잭션. 현재 저장 직전 최신 자료를 다시 읽지만 localStorage의 다중 탭 경합까지 직렬화하지 않는 로컬 정책.
- 직접 사운드 청취, 사용자 개발 도구 조작을 막는 서버 검증과 장치 간 기록 동기화.

## 관련 1차 문서

조합 종료와 취소의 의미는 [MDN compositionend](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event), 조합 입력 표시는 [MDN InputEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/isComposing) 참고.

beforeinput이 항상 발생하거나 취소 가능한 것은 아니라는 입력 복구 경계는 [MDN beforeinput](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event) 참고. 단조 시각 선택과 OS sleep 차이는 [MDN performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) 참고. 이 프로젝트는 백그라운드 복귀 보정을 통한 기록 유지 대신 숨김 시 취소 정책 사용.

## 재현

```sh
npm run check
npm test
npx playwright test tests/e2e/challenge.spec.ts
npm run test:e2e
node scripts/capture-challenge.mjs
node scripts/measure-challenge.mjs
npm run build
npm run preview -- --port 5182
node scripts/smoke-production.mjs
```

스크립트는 로컬 개발 서버 5180 또는 프로덕션 미리보기 5182 실행 필요. Chrome 성능 측정은 다른 브라우저 검증과 동시에 실행하지 않는 조건.
