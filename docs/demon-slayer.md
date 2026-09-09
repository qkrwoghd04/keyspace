# 탄지로의 호흡

2026-09-09, Keyspace의 귀멸의 칼날 전용 개선. 참조 이미지 파일은 이번 대화에 전달되지 않아, 요청의 굵은 붓질과 다층 수류, 포말 및 회전 화염 설명을 기준으로 제작. 공식 이미지, 영상, OST나 캐릭터 모델 사용 없음.

## 경험과 구현 경계

82개 키의 75% ANSI 배열, native textarea, 기존 IME 및 소스별 물리 눌림, 포인터 hit test와 포커스 정책 유지. 큰 캐릭터 초상 대신 수류와 검격, 후면 도검 레일, 작은 탄지로 상태 표시로 캐릭터성 보조.

| 모듈 | 책임 |
| --- | --- |
| `themes/demon-slayer/config.ts` | Water와 Sun 팔레트, 각성 및 품질 한도 |
| `input/TypingPerformance.ts` | 최근 5초의 확정 입력과 이미 판정된 정답 및 오답 관찰 |
| `themes/demon-slayer/BreathState.ts` | 시간 주입형 순수 Water / Awakening / Sun / Cooling 상태 머신 |
| `themes/demon-slayer/BreathController.ts` | 기존 CompositionGate와 ChallengeChannel 연결, UI 및 사운드 전환. 점수 변경 없음 |
| `themes/demon-slayer/SlashGeometry.ts` | 서로 다른 수류와 회전 화염의 3D 경로, 단면과 폭, 끝의 갈라짐 |
| `themes/demon-slayer/SlashSystem.ts` | 고정 GPU 버퍼의 검격 풀, 붓질 셰이더, 각성 중 물과 화염의 공간적 혼합 |
| `themes/demon-slayer/BreathEffects.ts` | 최근 실제 키 경로, 선두 검격과 짧은 잔흔, 포말, 물거품, 불티 |
| `themes/demon-slayer/sound.ts` | Water와 Sun의 독립 합성 프로필, 짧은 각성음 |
| `themes/demon-slayer/BreathControls.tsx` | 귀칼에서만 보이는 Auto / Water / Sun 및 상태, 규칙 안내 |
| `themes/animation/demon-slayer.ts` | 기존 AnimationRuntime에 연결한 키보드 모델과 호흡 렌더러 |

ChallengeChannel의 판정은 기존 렌더러 제한 이전에 구독. 따라서 낮은 품질, 효과 끄기와 모션 감소가 각성 조건을 바꾸지 않는 구조. 기존 ChallengeRewards는 귀칼에서 판정 연출 요청의 상한만 유지하고 일반 공통 리본이나 파티클을 중복 렌더링하지 않는 처리.

입력 이벤트의 취소나 값 대체 없음. Playground의 기존 onChange 및 composition 관찰과 가상 편집 직후의 텍스트 관찰만 추가. 반복 키 여부 관찰도 preventDefault 없는 읽기 전용. 텍스트와 입력 점수의 소유권은 기존 App 및 RaceEngine에 유지.

## 자동 각성 규칙

기본 Auto는 Water. 최근 5초의 새 확정 문자 수에 12를 곱한 CPM 사용. 전체 경기의 WPM이나 CPM을 다시 계산하거나 결과에 더하는 값이 아닌 시각 연출용 최근 활동률.

| 단계 | 전환 조건 |
| --- | --- |
| Water → Awakening | 240 CPM 이상, 25 콤보 이상, 4초 연속 입력, 4개 이상의 1초 구간에 입력 분산, 마지막 입력 이후 650ms 미만. 이 조건을 900ms 유지 |
| Awakening → Sun | 낮은 유지 조건을 충족하면서 900ms 전환 완료 |
| Sun 유지 | 156 CPM, 최근 비율 87%, 8 콤보 이상의 느슨한 유지 조건. Sun 진입 후 최소 4초 유지 |
| Sun → Cooling | 유지 조건의 약화가 2.2초 이상 지속되면서 최소 Sun 유지 시간 경과 |
| Cooling → Water | 1.6초의 자연스러운 냉각 완료 |
| 재각성 | Water 복귀 후 2.5초 대기 뒤 다시 안정된 각성 조건 필요 |

공통 입력 연속성은 1.4초를 넘는 입력 공백에서 끊기는 처리. 잘못된 시간을 주입해도 상태 머신의 시간이 역행하지 않는 구조.

Challenge에서는 이미 판정된 새로운 정답 위치와 오타 수를 사용하며, 최근 정답 비율 96% 이상이 각성 진입 조건. 같은 위치의 삭제와 재입력은 기존 엔진이 새로운 정답으로 보내지 않으므로 각성용 새 정답에도 중복 반영되지 않는 구조. 경기의 누적 정확도와 최근 5초 각성 비율은 서로 다른 관측 구간.

Playground에는 정답이 없으므로 정확도 주장을 하지 않는 처리. 새로 이어 쓴 확정 grapheme 수와 수정 비율을 입력 리듬의 대용값으로 사용. 선택 편집과 삭제는 연속성 중단, 붙여넣기와 이력 복원 및 반복 키 입력은 관찰 기준 재설정. 한 번의 대량 삽입은 최대 12자로만 관찰하고 한 시간 구간에만 속하므로 즉시 각성 불가. 조합 중인 자모, 취소된 조합과 같은 확정값의 중복 이벤트는 제외.

수동 Water와 Sun은 고정 선택. Auto로 돌아갈 때만 자동 강약 판정 적용. 수동 반전은 현재 혼합값에서 새 전환을 시작하고 전환 메시나 애니메이션 대기열을 쌓지 않는 처리. 탭 숨김과 blur는 자동 각성 관찰과 시각 이력을 초기화하며 수동 설정은 유지. 테마 선택이나 호흡 상태의 localStorage 저장 없음.

## 검격과 연출

- Water: S자 곡선, 넓고 회전하는 단면, 짙은 청색 바닥과 파란 몸체, 하늘색 능선과 흰 포말. 곡선 굽이에 입체 포말과 작은 고리형 물거품 배치.
- Sun: 물의 경로와 다른 약 250도 되감기 수식, 돌려 베는 반원형 궤적, 붉은 외곽과 주황 몸체, 금빛 중심. 실제 정점의 톱니형 끝과 셰이더의 가는 갈라짐, 짧은 불티 사용.
- 연속 입력: 최근 4개 위치를 곡선으로 이어 하나의 선두 검격으로 표시. 이전 검격은 180ms 이하의 낮은 불투명도 잔흔으로 전환. 일반 이펙트가 같은 원형 파동의 나열이 되지 않는 구성.
- 각성: 약 900ms 동안 뒤쪽 국소 검격이 강하게 휘감기고 중심부터 금빛이 번지며 화염 경로로 변형. 화면 전체의 발광, 흔들림이나 플래시 없음. 물과 적색을 일률 혼합해 보라색이 되는 표현도 회피.
- 열기: 화염 가장자리의 매우 작은 정점 일렁임과 잔광. 실제 배경 영상을 굴절시키는 고비용 화면공간 열 왜곡은 미구현.
- 3D: 모든 검격과 입자는 키보드 model group에 속하며 깊이 검사 사용. 카메라 투영과 모델 회전에 함께 종속. 텍스트 위의 2D 이펙트 오버레이 없음.
- 소프트웨어 입력: 신뢰할 실제 키 code가 없는 확정 입력은 Space 인근에 표시. 한글 문자를 임의의 물리 키로 추정하거나 실제 눌림을 만들어 내지 않는 처리. 이 경우 특정 문자 키의 정확한 위치 반응은 보장하지 않는 범위.

## 성능과 소리 정책

| 항목 | 기본 | 저품질과 모바일 |
| --- | --- | --- |
| 일반 검격 | 최대 8개 | 최대 3개 |
| 각성 검격 | 별도 1개, 재생 대기열 없음 | 동일한 1개 |
| 포말 / 고리 / 불티 | 36 / 18 / 18 | 14 / 7 / 7 |
| 검격 수명 | Water 620ms, Sun 540ms | 동일 |
| 최근 경로 / 키 표시 이력 | 4개 위치 / 7개 code | 동일 |
| 방출 간격 | 최소 24ms | 최소 50ms |
| 모션 감소 | 일반 국소 검격 130ms, 공간 이동 및 입자와 각성 모션 억제 | 동일 |

단면의 9개 정점과 64개 구간의 고정 버퍼 사용. 입력마다 기존 버퍼를 갱신하며 GPU 객체 추가 생성 없음. 주변 대기 수류는 하나의 고정 메시. 최근 4개 키를 이은 경로도 9 모델 단위를 넘으면 앞쪽 경로부터 축소해 키보드 전체를 반복 덮지 않는 처리. 과밀 입력은 장식만 줄이며 키 눌림과 텍스트, 게임 판정은 그대로 유지.

Water는 맑은 짧은 공명과 물살, Sun은 낮고 묵직한 몸통과 화염성 마찰로 서로 다른 합성식 사용. 각성은 280ms 상승음. 배경 음악 없음. 모두 기존 SwitchSound의 단일 AudioContext, 16개 채널, 마스터 음량, 압축기와 리미터 사용. 900ms 이내 각성음 재요청 생략. 기본 음소거, 숨김 시 정지 및 다음 실제 입력에서 재개 정책 유지. Water/Sun 전환에 따른 마스터 음량 변경 없음.

버퍼 상한은 기존 84개에 Sun의 3개 키 종류별 press/release 6개와 각성 1개를 더한 91개. 필요 시 한 번씩 합성하고 재사용. 여러 프레임에 걸친 재생 소스 객체는 재사용 가능한 AudioBuffer와 구분.

## 검증과 남은 튜닝

검증 코드는 `src/input/TypingPerformance.test.ts`, `src/themes/demon-slayer/*.test.ts`, `src/input/SwitchSound.test.ts`, `tests/e2e/breath.spec.ts`에 보관.

- 단위 검사 73개 통과: 기존 판정과 입력을 포함해 최근 5초 관찰, 동시 조건, 히스테리시스, 수동 반전, IME 중복, 구독 정리, 2,000회 요청의 GPU 풀 상한과 오디오 소스 상한 검사.
- 호흡 브라우저 검사 14개 통과: 수동과 자동 전환, 상태별 다른 입자, 최근 경로, 실제 키 좌표의 연결, 기존 텍스트와 선택 유지, 실제 게임 결과 불변, 반복 입력과 오타의 각성 제외, Chromium CDP 한글 조합 확정과 취소, 모션 감소와 효과 끄기 및 6개 화면 크기 검증. 기존 58개와 함께 전체 72개 회귀 구성.
- 24kHz, 44.1kHz, 48kHz의 유한 PCM, 영점 평균, 0.235 이하 피크와 300ms 이하 길이 확인. 원본 Water 문자음 RMS 약 0.0326, Sun 약 0.0402로 같은 피크에서 다른 질감과 밀도 확인. 이 수치는 청감 평가나 음압 측정의 대체물이 아닌 범위.
- Water와 Sun의 데스크톱 및 모바일 캡처, 각성과 냉각 장면 시각 확인. 이후 실제 기준 이미지가 제공되면 붓의 가장자리, 포말 밀도와 회전 폭을 추가 맞춤할 수 있는 상태.
- 다른 브라우저 검사와 동시 실행하지 않은 M5 Pro / Chrome 152 / 1440×900 / DPR 2에서 Water 30.02초 988자, Sun 30.00초 990자의 native 자동 입력 검증. 각각 60.03fps와 59.99fps, P95 최대 16.8ms. 워밍업 후 geometry 및 texture 수 고정, 테마 20회 왕복의 리소스 안정 확인.
- 로컬 프로덕션 빌드에서 14개 테마, Water/Sun 수동 전환, 자동 각성, 66자 정답과 26.4 WPM의 30초 결과, 저장과 Ghost 재도전 확인. 개발 전용 API 2개 제외 및 브라우저 오류 0개 확인. 운영 사이트 확인은 이 로컬 측정과 구분.

실제 운영체제 한글 IME, 실제 iOS와 Android 소프트웨어 키보드, 휴대폰 GPU와 발열, Safari 및 Firefox, 스피커와 이어폰 직접 청취는 미검증. Chromium CDP와 viewport 에뮬레이션을 실제 기기 검증이라고 주장하지 않는 범위. 물살과 타격의 청감 비율, Sun의 저역 무게 및 고속 입력 시 피로도는 직접 청취 후 추가 튜닝 대상.

산출물: `artifacts/breath/`의 화면, native 입력과 자동 각성 및 수동 냉각을 녹화한 무음 `typing-breath.webm`, `sound-comparison.wav`와 `sound-report.json`, 독립 실행 부하의 `performance.json`. 정확한 최신 전체 회귀와 성능 수치는 [공통 검증 기록](verification.md)에 반영.

## 참고한 API 근거

동적 정점 버퍼 갱신은 [Three.js BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html), 물과 불의 다층 표현은 [ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html)의 공식 계약을 기준으로 구성. 조합 종료 경계는 [MDN compositionend](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event), 재사용 버퍼와 일회용 재생 소스의 구분은 [MDN AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) 참고.
