# 14개 키보드 컬렉션과 Challenge 검증

검증 갱신: 2026-09-23. 30초 서버 Challenge 구현 후 전체 회귀와 API 부하 검사. 아래 결과는 로컬 검증이며 운영 서버의 실제 트래픽/네트워크와 실기기 성능 보장과는 구분. 운영 사이트 전환 미실행.

## 실행 환경과 결과

- Node.js 24.14.1, npm 11.11.0, Vite 7.3.6, Three.js 0.180.0.
- macOS, Google Chrome 154의 headless 모드, 실제 WebGL2 사용. 기존 2026-09-09 측정은 Chrome 152.
- GPU 문자열: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)`.
- TypeScript 검사, 프로덕션 빌드, Vitest 65개 통과. 공유 판정과 서버 13개 검사, 저장 실패 롤백, 동점 순위와 버전 분리 포함.
- 전체 Playwright 60개 통과, 약 4.2분. 새 Challenge 11개와 디지몬 4개, 기존 공통 입력/IME/14개 테마/장시간 회귀 포함.
- 한글 조합 중간값/취소/중복 확정, 삭제/재입력, 30초 경계, 취소/탭 이탈, 저장 응답 유실 후 같은 경기 재시도 통과.
- Chrome 154.0.8037.45와 Firefox 155.0의 별도 프로세스에서 실제 30초 경기 각각 1회, 서버 저장과 공용 순위 공유, 서로 다른 개인 이력 확인.
- 프로덕션 화면에서 14개 전환, 단일 canvas, native 편집과 문장 보존, 정적 썸네일, 실패 청크 재시도 통과. 개발 전용 진단 API 두 개 제외, 브라우저 오류 0개.
- Challenge의 서버 규칙과 개인정보 경계는 [별도 문서](challenge.md) 참고. Playground 입력 전송 없음. 이전 브라우저 기록은 미이전/미삭제.
- Three.js vendor chunk 533.46 kB / gzip 135.37 kB의 기존 크기 경고 잔존. 코드 분할된 렌더러와 Challenge 유지.

## 100명 동시 접속과 저장 실측

2026-09-23 로컬 Docker Desktop, Linux arm64 Node 24.14.1, SQLite 3.53.4 WAL, CPU 2개 / 메모리 1GiB 제한. 다른 기능 검증과 같은 M5 Pro 호스트 사용. 외부 네트워크 RTT와 운영 서버 부하는 미포함.

| 항목 | 실측 |
| --- | --- |
| 동시 참가자 | 100명, 한국어 50명 / 영어 50명, 각각 별도 쿠키 |
| 검사 시간 | 600.02초 |
| 반복 경기 | 참가자당 17회, 총 1,700개. 실제 3초 준비 + 30초 대기, 시간 가속 없음 |
| 동시 제출 / 재시도 | 매 회 100건 동시 제출 후 100건 재전송, 제출 요청 총 3,400건 |
| 전체 API 요청 | 10,400건 |
| 전체 응답 P95 / 최대 | 130.11ms / 405.90ms |
| 결과 제출 P95 | 177.48ms |
| 순위 조회 P95 | 56.28ms |
| 개인 이력 조회 P95 | 45.67ms |
| 경기 시작 P95 | 121.61ms |
| 기록 유실 / 중복 | 0건 / 0건 |
| 서버/API 오류 | 0건 |
| 기준 | 오류/유실/중복 0건, P95 500ms 이하 통과 |

매 회 개인 이력에서 직전 경기 확인, 종료 시 모든 참가자의 전체 이력 ID 대조. 마지막 온전한 경기 이후 남은 시간 대기 후 최종 조회. 합성 API 참가자 부하이며 100개 브라우저의 GPU 부하를 뜻하지 않는 범위. 검사 중 한 시점 RSS 관찰값 약 122MiB, 최대 RSS를 지속 샘플링한 수치는 아님.

`artifacts/challenge/load-report.json`에 요청 수와 경로별 지연 분포 보관. `scripts/load-challenge.ts`로 재현.

## 영구 저장과 복원 실측

부하 검사 종료 후 참가자 100명, 경기와 결과 각각 1,700개가 있는 DB 사용.

- 서버 프로세스를 포함한 컨테이너 재시작 후 전체 행 수와 SHA-256 데이터 지문 일치.
- 기존 컨테이너를 새로 생성하고 동일 영구 볼륨 연결 후 전체 데이터 지문 일치.
- 실행 중 SQLite online backup 생성 후 새 볼륨으로 복원, 별도 컨테이너 시작 성공.
- 복원 후 전체 행 수와 데이터 지문 일치, 한국어/영어 순위 응답 일치.
- 원본/재시작/재생성/복원 DB 모두 integrity_check = ok, foreign_key_check 오류 0개, WAL 활성화.
- 쿠키 소유권 보존은 서버 단위 검사에서 DB 재연결 및 백업 파일 복원 후 확인.

`artifacts/challenge/storage-report.json`에 비교 결과 보관. `scripts/verify-storage.mjs`는 지정된 로컬 capacity 테스트 컨테이너에만 적용. 원본 볼륨을 덮어쓰거나 삭제하지 않으며 복원용 볼륨 별도 생성. 운영 절차는 [배포 준비](deployment.md) 참고.

## 디지몬 교체 검증

귀멸의 칼날 목록, 전용 호흡 UI, 런타임 및 사운드 연결 제거. 전체 14개 컬렉션 유지. 구조는 [디지몬 테마](digimon.md) 참고.

- 실제 Enter 입력으로 아구몬 → 그레이몬 → 메탈그레이몬 → 워그레이몬 순차 진화 확인. 그레이몬 8.5초 및 최종 단계 20초 후에도 유지, 최종 단계의 추가 Enter에서 되감기 없음.
- Space 화염, 쌍발 미사일, 에너지 구체와 native 줄바꿈 및 공백 보존. 단위 검사에서 전 단계 기술 실행 전후 geometry UUID 목록 동일.
- reset으로 진화 및 입자 정리. Chromium CDP 한글 조합에서 가짜 물리 패킷 생성 없음.
- Challenge에서 14개 테마 모두 입자와 대표 연출 0개 확인. 디지몬은 아구몬 정적 모습과 키 눌림 유지, 정답 12자 = 0.40글자/초. Playground의 워그레이몬 진화 유지.
- 기존 6개 viewport에서 최종 단계와 에너지 구체의 보수적 모델 경계 및 가로 넘침 확인. 공통 모바일 시트 포커스 검사 유지. 2,000회 대표 연출 요청의 시작 1회와 대기열 0개 검사 통과.
- 단위 검사에서 2,000개 데이터 패킷 요청에도 같은 geometry 유지, 기본 48개 / 낮은 품질 18개 제한과 수명 종료 확인.

새 화면과 무음 영상은 `artifacts/digimon/`, 썸네일은 `public/themes/digimon.png`에 보관. 소스, scripts, 빌드 출력에 삭제한 테마의 실행 참조 없음. 제거 확인을 위한 부정 테스트의 문자열만 유지. 이전 귀칼 구현은 Git 기록에서 복구 가능.

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
| 입력 순서 | `jajj` 입력에서 데이터 패킷 이력이 KeyJ → KeyA → KeyJ → KeyJ 순서로 일치 |
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

렌더링 벤치마크는 다른 Chrome 검증과 겹치지 않게 실행. 새 Challenge 및 장시간 회귀 검사 중 로컬 API 부하 검사는 병행. 아래 모바일 값은 휴대폰 GPU 결과가 아닌 M5 Pro에서의 모바일 에뮬레이션 결과.

| 조건 | 범위 | 측정 결과 |
| --- | --- | --- |
| 데스크톱 1440×900, DPR 2, 기본 품질 | 테마당 1초 워밍업 후 4초간 10Hz 합성 키 이벤트 | 14개 모두 약 60fps, 프레임 P95 최대 16.8ms |
| 모바일 390×844, 기기 DPR 3, renderer 상한 1.25, 저품질 | 동일한 14개 모델 측정 | 14개 모두 약 60fps, 프레임 P95 최대 16.8ms |
| 데스크톱 1440×900, DPR 1, Inferno | 초당 30회 합성 키 이벤트, 60초, 총 1,800회 | 약 60fps, 입력 수 일치, 눌림 고착 없음 |
| 전체 14개 테마 10회 순환 | 전환별 입력과 잔향 소멸 확인, 총 140회 전환 | 두 번째 순환 워밍업 이후 테마별 geometry / texture 수 동일, 프로그램 수 지속 증가 없음 |
| Inferno Challenge, DPR 2, 효과 없음 | 가짜 시계 없이 실제 30초, native 자동 타이핑 946자 | 오타 0, 최종 30,000ms, 31.53글자/초, 약 60.00fps, 서버 저장 정상 |
| Playground / Challenge 20회 왕복 | 모드 전환과 기록 조회 | 워밍업 후 geometry 104 / texture 4 / 프로그램 9 고정 |
| 최종 진화 포함 디지몬, 1440×900, DPR 2 | 실제 30초 native 자동 입력 759자, 최종 진화와 단계별 기술 포함 | 60.01fps, P95 16.8ms, 텍스트 및 물리 입력 수 일치, 오류 0개 |
| 디지몬과 Studio 8회 왕복 | 모든 진화 단계 및 기술 워밍업 이후 비교 | geometry / texture / 프로그램 수 고정 |

Challenge 30초와 20회 모드 왕복, 60초/1,800회 합성 키 입력과 140회 테마 전환은 이번 변경 후 새로 실행. 장시간 검사 평균 60.005fps, 마지막 프레임 P95 16.7ms. Challenge 표본별 프레임 P95 최대 36.1ms는 초기 준비 구간 포함, 평균 약 60fps와 구분.

디지몬의 30초/8회 왕복은 이전 최종 진화 확장 시점의 관찰값. 모든 테마별 짧은 개별 측정은 2026-09-09 관찰값으로 유지. 이번 전체 회귀에서 디지몬의 최종 진화, 4단계 기술, 6개 viewport는 다시 확인. 실제 휴대폰 결과와 구분.

관련 원본:

- `artifacts/performance/materials-report.json`: 테마별 품질, FPS, P95, GPU, draw call과 리소스 수.
- `artifacts/performance/stress-report.json`: 초당 샘플 60개와 전체 140회 전환 기록.
- `playwright-report/index.html`: 가장 최근 브라우저 실행 결과. 전체 재현은 `npm run test:e2e` 실행.
- `artifacts/production/report.json`: Chrome/Firefox의 프로덕션 빌드 검사 결과.
- `artifacts/challenge/performance.json`: 실제 30초 입력, 서버 저장과 모드 전환 검사.
- `artifacts/challenge/load-report.json`, `storage-report.json`: API 부하와 영구 저장 검증.
- `artifacts/challenge/preview-1440.png`, `preview-390.png`, `preview-320.png`: 최신 공용 순위 화면.
- `artifacts/digimon/performance.json`: 실제 30초 디지몬 입력과 8회 왕복의 품질, P95 및 리소스 관찰값.

`renderer.info.memory`와 셰이더 프로그램 수는 GPU 객체 수의 관찰값이며 GPU 메모리 바이트나 JavaScript heap 전수 분석 결과가 아님. 프레임 시간은 RAF 간격으로 측정하며 정적인 클래식의 유휴 정지는 별도 기능 검사.

## 미확인 범위와 알려진 한계

- 운영체제의 실제 한글 IME 조합, 확정과 삭제: 직접 검증 미실시.
- 실제 iOS / Android 기기, 소프트웨어 키보드, 열 제한과 저사양 GPU: 직접 검증 미실시.
- 실제 OS 창 전환: 자동 blur / visibility 이벤트 정리 검사와 구분, 직접 수동 검증 미실시.
- 사운드 직접 청취: 미실시. 14개 합성 파형의 유한 값, 최대 길이, 프로필 차이와 엔진 상태만 검증. 25.2초 청취용 `artifacts/audio/material-comparison.wav`와 테마별 시작 시각의 `timeline.json` 제공.
- WebKit: 미검증. Firefox는 실제 경기/저장/순위/개인 이력만 확인, 테마 전체와 IME 전수 검사는 Chrome 범위. 오류 URL을 제공하지 않는 브라우저의 동적 import 재시도에는 제한 가능성.
- 성능 기준은 현재 Mac의 Chrome 결과. 다른 기기의 60fps 또는 30fps를 보장하는 결과는 아님.
- 운영 주소 접속 확인은 위 로컬 기능 및 부하 측정과 별도 범위.
- 소프트웨어 code가 없는 문자의 특정 물리 키 위치 추정은 구현 범위에서 제외. 원작 장면의 정확한 재현이나 직접 청취로 조정한 믹싱 품질을 보장하는 결과가 아닌 상태.

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
node scripts/capture-digimon.mjs
node scripts/measure-digimon.mjs
node scripts/render-sound-demo.mjs
npm run build
npm run preview -- --port 5182
# 별도 터미널
node scripts/smoke-production.mjs
```

산출물은 `artifacts/`와 Playwright report에 저장, Git 제외. 배포용 실제 썸네일은 `public/themes/`에 포함. Playground 문장, 사운드 설정과 테마 선택은 페이지 메모리에만 보관. Challenge는 별도 최소 결과 스키마만 브라우저 저장소 사용.
