# 14개 키보드 컬렉션과 Challenge 검증

검증일: 2026-09-09. 아래 기능과 부하 수치는 로컬 자동 검증 결과이며 운영 환경의 실기기 성능 보장과는 구분.

## 실행 환경과 결과

- Node.js 24.14.1, npm 11.11.0, Vite 7.3.6, Three.js 0.180.0.
- macOS, Google Chrome 152의 headless 모드, 실제 WebGL2 사용.
- GPU 문자열: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)`.
- TypeScript 검사, Vitest 54개 통과. Challenge의 렌더링 없는 판정, 조합, 저장과 세션 검사 29개 포함.
- Playwright 기존 입력 및 화면 회귀 44개, Challenge 13개, 60초 부하 및 140회 전환 검사 1개 통과. 전체 58개 실행 시간 약 4.4분.
- 신규 ANIMATION 전용 검사 19개 포함. 기존 Inferno / Jelly 및 native 편집 회귀도 같은 전체 실행에서 통과.
- Challenge의 한글 조합, 규칙, 저장 실패, Ghost와 검증 한계는 [별도 검증 문서](challenge.md) 참고. Playground 개인 문장 저장 없음, 브라우저 저장소는 Challenge 최소 결과와 이력에 한정.
- 빌드된 로컬 프로덕션 미리보기에서 14개 전환, 단일 canvas, 문장 보존, native 편집, 정적 썸네일과 실패 청크 재시도 통과. Challenge의 30초 결과, 저장, 실제 Ghost 선택과 재도전 포커스 및 Playground 복귀 확인. 두 개발 전용 진단 API 제외와 처리되지 않은 브라우저 오류 0개 확인.
- Three.js vendor chunk 533.46 kB / gzip 135.37 kB에 대한 Vite 크기 경고 잔존. 오류는 아니며 기존 확장 모델 6개와 애니메이션 모델 5개는 개별 지연 로드 청크로 분리. Challenge 로직과 UI도 별도 25.92 kB / gzip 10.13 kB 청크로 첫 선택 시 지연 로드.

## 기능 검증

| 항목 | 근거와 결과 |
| --- | --- |
| 컬렉션 | 14개 선택, CLASSIC / EXPERIMENTAL / ANIMATION 분류, 14개 정적 썸네일, 단일 canvas 유지 |
| Studio 보존 | 확장 전 `artifacts/baseline/studio-desktop.png`와 확장 후 장면 캡처. 기존 모델과 눌림 어댑터 유지 |
| LNB | 전체 접기 후 canvas 가용 너비 증가, 그룹별 접기와 펼치기, 현재 그룹 이름 표시, NOW VIEWING으로 선택 항목 복귀, 컨트롤 키 조작의 타건 제외 |
| 모바일 시트 | 선택 후 닫기, Escape, 트리거로 포커스 복귀, 입력창 강제 포커스 없음 |
| native 편집 | 영문 입력, 선택, 삭제, Enter, 실제 브라우저 Meta+C/V, 테마 전환 시 선택과 문장 보존 |
| 입력 소스 | 짧은 탭, 자동 반복 keydown 제외, 6개 키 5초 hold, 물리 키와 포인터 중복, 전환 시 캡처 정리 |
| Jelly | hold 중 A 키 스케일 X 약 1.07 / Y 0.60 / Z 1.06, 해제 복귀와 복귀 중 즉시 재입력 |
| Inferno | 3D 불꽃 48개 이하, 테마 전환 중 물리 hold 유지와 타격 재발생 없음 |
| 실패 복구 | 모듈 요청 중단 후 기존 모델과 문장 보존, 연결 복구 후 Try again 성공 |
| 소리 | 기본 음소거와 AudioContext 미생성, 14개 프로필, 음량 27%와 mute의 전환 간 보존 |
| 음성 상한 | 단위 테스트에서 같은 시각 2,000회 요청에도 16개 채널, 최대 32개 소스 객체 유지. 5ms 교대 중 대기 소스 포함 수이며 실제 동시 재생 채널은 16개 이하 |
| 접근성 설정 | 모션 감소에서 모든 idle 정지와 Jelly hold 유지. 숨김 이벤트 후 RAF, 음성 및 눌림 정리 |
| 터치 | Chrome 모바일 에뮬레이션과 CDP touchStart / touchCancel로 타건, 문장 입력 및 해제 확인 |
| IME guard | 합성 composition 중 가상 키 삽입 차단만 확인. 실제 운영체제 조합 검증과 구분 |
| WebGL 실패 | 컨텍스트 생성 차단 후 대체 안내, native 편집 및 테마 UI 유지 |

화면 검증 크기: 1440×900, 1024×768, 768×1024, 390×844, 320×568, 844×390. 각 크기에서 Inferno, Grove와 Orbit의 경계 투영 및 가로 넘침 검사. 최소 화면에서는 필요한 세로 스크롤 허용.

기존 9개 데스크톱 idle / hold 캡처에 신규 5개의 idle, hold, 일반 타건, Enter와 Space 캡처 추가. Glass의 가공된 연속 모서리와 Glacier의 다면체 및 서리 구분 확인. 신규 5개 모두 위 6개 화면 크기에서 Enter 실행 중 보수적 모델 경계 투영, 가로 넘침과 모바일 시트 포커스 복귀 검사 통과. 보수적 bounds 검사이며 모든 입자의 픽셀 단위 자동 가시성 판정과는 구분.

장면 캡처 결과는 `artifacts/collection/`, 기존 반응형 화면은 `artifacts/responsive/`, 신규 장면과 모바일 캡처는 `artifacts/animation/`에 보관. 실제 장면을 사용한 전체 14개 및 신규 5개 비교 이미지도 생성 완료.

## ANIMATION 전용 검증

| 항목 | 근거와 결과 |
| --- | --- |
| 입력 순서 | `jajj` 입력에서 궤적 이력이 KeyJ → KeyA → KeyJ → KeyJ 순서로 일치. 동일 키 재입력에도 길이가 있는 국소 검격 생성 |
| 포켓몬 동료 | 일반 키에서 동료 반응량과 시선 변화, Enter에서 몬스터볼 개방, Space에서 두 충전 궤적과 닫힌 볼 상태 확인 |
| 만화 렌더링 | 셀 명암, 망점, 외곽선과 CMY 잔상 시각 확인. 실제 키 Y 변위는 다음 RAF에 반영, native 입력과 줄바꿈 및 삭제 유지 |
| 살아 있는 하우징 | 일반 키에서 톱니 에너지, 창문 열기, 다리 에너지와 굴뚝 반응 확인. 연결된 굴뚝과 하부 관절의 Enter 장면 시각 확인 |
| 격납고 순차 동작 | 브라우저 RAF로 800ms 관찰, 잠금 → 피스톤 → 장갑판의 시작 순서와 완전 닫힘 복귀 확인 |
| 대표 연출 제한 | 5개 각각 Enter와 Space 2,000회 합성 요청 후 starts 1, queued 0 확인. 1.5초 후 종료와 추가 Space 요청의 새 실행 확인 |
| 모션 감소 | 5개 모두 대기 RAF 정지, 대표 연출 시작 0회, 입력 파이프라인 유지 |
| 공통 상태 | 14개 전환 동안 82개 키, 같은 canvas, 문장, 선택 범위와 27% 사운드 설정 유지 |

2,000회 검사는 연출 제한을 확인하기 위한 합성 물리 키 이벤트이며 2,000자의 native 입력 성능 측정으로 간주하지 않는 범위. 실제 브라우저 텍스트 편집은 별도 회귀에서 검사. 렌더링 사이 64개를 넘는 초고속 요청은 오래된 장식만 생략하며 native 텍스트에는 영향 없음.

원작 영상, 공식 모델, OST와 성우 음성 사용 없음. 포켓몬 동료를 포함한 모든 신규 모델은 코드로 만든 단순화된 절차적 형상이며 외부 에셋의 확보를 가정하지 않은 상태. 세부 확보 상태는 README의 외부 에셋 절 참고.

## 성능과 리소스

벤치마크는 다른 Chrome 검증을 동시에 실행하지 않은 상태에서 측정. 아래 모바일 값은 휴대폰 GPU 결과가 아닌 M5 Pro에서의 모바일 에뮬레이션 결과.

| 조건 | 범위 | 측정 결과 |
| --- | --- | --- |
| 데스크톱 1440×900, DPR 2, 기본 품질 | 테마당 1초 워밍업 후 4초간 10Hz 합성 키 이벤트 | 14개 모두 약 60fps, 프레임 P95 최대 16.8ms |
| 모바일 390×844, 기기 DPR 3, renderer 상한 1.25, 저품질 | 동일한 14개 모델 측정 | 14개 모두 약 60fps, 프레임 P95 최대 16.8ms |
| 데스크톱 1440×900, DPR 1, Inferno | 초당 30회 합성 키 이벤트, 60초, 총 1,800회 | 약 60fps, 입력 수 일치, 눌림 고착 없음 |
| 전체 14개 테마 10회 순환 | 전환별 입력과 잔향 소멸 확인, 총 140회 전환 | 두 번째 순환 워밍업 이후 테마별 geometry / texture 수 동일, 프로그램 수 지속 증가 없음 |
| Inferno Challenge, DPR 2, 기본 콤보 | 가짜 시계 없이 실제 30초, native 자동 타이핑 917자 | 오타 0, 완료 시각 30,000ms, 약 59.95fps, 결과 저장 정상 |
| Playground / Challenge 20회 왕복 | 보상 객체 생성과 정리 | 워밍업 후 geometry / texture / 프로그램 수 동일, Playground에서 보상 객체 없음 |

관련 원본:

- `artifacts/performance/materials-report.json`: 테마별 품질, FPS, P95, GPU, draw call과 리소스 수.
- `artifacts/performance/stress-report.json`: 초당 샘플 60개와 전체 140회 전환 기록.
- `playwright-report/index.html`: 전체 58개 결과. 재현은 `npm run test:e2e` 실행.
- `artifacts/production/report.json`: 프로덕션 빌드 스모크 검사 결과.

`renderer.info.memory`와 셰이더 프로그램 수는 GPU 객체 수의 관찰값이며 GPU 메모리 바이트나 JavaScript heap 전수 분석 결과가 아님. 프레임 시간은 RAF 간격으로 측정하며 정적인 클래식의 유휴 정지는 별도 기능 검사.

## 미확인 범위와 알려진 한계

- 운영체제의 실제 한글 IME 조합, 확정과 삭제: 직접 검증 미실시.
- 실제 iOS / Android 기기, 소프트웨어 키보드, 열 제한과 저사양 GPU: 직접 검증 미실시.
- 실제 OS 창 전환: 자동 blur / visibility 이벤트 정리 검사와 구분, 직접 수동 검증 미실시.
- 사운드 직접 청취: 미실시. 14개 합성 파형의 유한 값, 최대 길이, 프로필 차이와 엔진 상태만 검증. 25.2초 청취용 `artifacts/audio/material-comparison.wav`와 테마별 시작 시각의 `timeline.json` 제공.
- WebKit / Firefox: 미검증. 실패 모듈의 URL을 오류에 포함하지 않는 브라우저의 동적 import 재시도에는 제한 가능성.
- 성능 기준은 현재 Mac의 Chrome 결과. 다른 기기의 60fps 또는 30fps를 보장하는 결과는 아님.
- 운영 주소 접속 확인은 위 로컬 기능 및 부하 측정과 별도 범위.

## 재현

```sh
npm run dev
# 별도 터미널
npm run check
npm test
npm run test:e2e
node scripts/measure-scenes.mjs
node scripts/generate-thumbnails.mjs
node scripts/capture-scenes.mjs
node scripts/render-sound-demo.mjs
npm run build
npm run preview -- --port 5182
# 별도 터미널
node scripts/smoke-production.mjs
```

산출물은 `artifacts/`와 Playwright report에 저장, Git 제외. 배포용 실제 썸네일은 `public/themes/`에 포함. Playground 문장, 사운드 설정과 테마 선택은 페이지 메모리에만 보관. Challenge는 별도 최소 결과 스키마만 브라우저 저장소 사용.
