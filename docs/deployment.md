# 서버 운영 준비

운영 사이트 전환 미실행. 기존 정적 nginx 배포에서 아래 앱 서비스로 라우팅을 변경하는 작업은 별도 배포 단계. 현재 실행 명령은 로컬 또는 승인된 서버에서만 사용.

## 단일 서비스

- Node.js 24.14.1, Fastify, SQLite 3.53.4.
- 컨테이너 하나, 내부 3000 포트. 웹 화면과 /api 동일 출처.
- SQLite는 로컬 블록 스토리지의 영구 볼륨. WAL 특성상 NFS/공유 네트워크 파일 시스템 제외.
- 기본 CPU 2개, 메모리 1GiB 제한. Redis, WebSocket, 외부 유료 저장소 없음.
- 비루트 UID 1000, 읽기 전용 이미지, /data와 /backups만 영구 쓰기. 로그 회전 10MB × 3개.
- 다중 프로세스/다중 복제본으로 같은 DB를 공유하지 않음. 서버 증설 시 별도 DB 전환 검토.

`.env.example`의 값을 별도 `.env`로 준비:

```dotenv
PUBLIC_ORIGIN=https://keyspace.todah.dev
KEYSPACE_PORT=5183
TRUSTED_PROXIES=
```

PUBLIC_ORIGIN은 경로와 마지막 슬래시 없는 정확한 브라우저 출처. 실제 프록시 주소 확인 전 TRUSTED_PROXIES는 비움. 프록시를 신뢰하지 않으면 IP 단위 제한은 프록시 하나에 합산되므로 운영 시 정확한 내부 주소 지정 필요.

```sh
docker compose -p keyspace build
docker compose -p keyspace up -d
docker compose -p keyspace ps
curl --fail http://127.0.0.1:5183/api/health
```

기존 HTTPS 프록시는 홈페이지뿐 아니라 /api까지 이 서비스로 전달. 별도 캐시 금지, 응답의 Set-Cookie 보존. DB 저장 경로 /data/keyspace.sqlite, 볼륨 keyspace_keyspace-data. 백업 볼륨 keyspace_keyspace-backups. 로컬 호스트 공개 포트만 바인딩하므로 외부 DB/API 직접 노출 없음.

최초 등록, 실제 30초 종료/저장, 다른 브라우저 순위, 재접속 개인 이력까지 확인한 후에만 전환 완료 판정. 정적 페이지만 열리는 것을 배포 완료로 보지 않음.

개발은 별도 터미널에서 `npm run dev:api`와 `npm run dev`. 5183 API와 5180 Vite 사용. 기본 로컬 DB는 data/keyspace.sqlite. 정적 `npm run preview`만으로는 서버 저장 미지원.

## 온라인 백업

실행 중인 WAL DB 파일 하나만 복사하지 않음. SQLite online backup으로 일관된 단일 파일 생성, integrity_check와 foreign_key_check 통과 후 성공 표시. 동일 파일 덮어쓰기 금지.

```sh
docker compose -p keyspace exec -T keyspace node scripts/backup-db.mjs /backups/keyspace-20260923.sqlite
docker cp keyspace-keyspace-1:/backups/keyspace-20260923.sqlite ./backups/keyspace-20260923.sqlite
```

파일명은 실행마다 새로 지정. 호스트의 backups 디렉터리를 미리 생성하고 권한 제한. 백업에는 참가자 식별 해시와 기록 포함. 서버 밖 암호화된 보관소로 별도 복사, 접근 권한 제한. 권장 운영 정책은 매일 백업, 일별 7개와 주별 4개 보관. 스케줄러와 외부 보관소는 이 구현에서 자동 생성하지 않은 상태.

## 안전한 복원

원본 볼륨을 덮어쓰지 않고 새 볼륨에 복원. 예시의 날짜와 컨테이너 이름은 실제 대상으로 확인 후 사용.

1. 쓰기 중단 또는 유지보수 시간 확보, 최신 DB 추가 백업.
2. 새 볼륨 keyspace-restore-20260923 생성.
3. 별도 일회성 컨테이너에서 백업 파일을 새 볼륨으로 복사하고 UID/GID 1000 설정.
4. 새 볼륨으로 검증 인스턴스 실행, 건강 상태와 전체 행 수/무결성 확인.
5. 기존 쿠키로 내 이력과 공용 순위 확인 후 승인된 배포 단계에서 새 볼륨 연결.
6. 이전 볼륨은 롤백용으로 유지. `down -v` 사용 금지.

복사 및 검증 예시:

```sh
docker volume create keyspace-restore-20260923
docker run --rm --network none --user 0 --mount type=volume,src=keyspace_keyspace-backups,dst=/backups,readonly --mount type=volume,src=keyspace-restore-20260923,dst=/data keyspace-challenge:local node --input-type=module -e 'import {copyFileSync,chownSync,existsSync} from "node:fs"; const target="/data/keyspace.sqlite"; if(existsSync(target))throw Error("Target exists"); copyFileSync("/backups/keyspace-20260923.sqlite",target); chownSync(target,1000,1000); chownSync("/data",1000,1000);'
docker run --rm --network none --mount type=volume,src=keyspace-restore-20260923,dst=/data keyspace-challenge:local node --input-type=module -e 'import DB from "better-sqlite3"; const db=new DB("/data/keyspace.sqlite",{readonly:true}); console.log(db.pragma("integrity_check"),db.pragma("foreign_key_check"),db.prepare("SELECT count(*) AS records FROM records").get()); db.close();'
```

Compose의 keyspace-data 볼륨에 `external: true`, `name: keyspace-restore-20260923`를 지정한 별도 오버라이드로 전환. 종료된 원본의 WAL/SHM을 새 파일과 섞지 않음. 백업 후 새로 들어온 기록은 해당 백업만으로 복구되지 않는 한계.

## 부하 검사

운영 데이터에 실행 금지. 새로운 Compose 프로젝트 이름과 포트로 격리:

```sh
PUBLIC_ORIGIN=http://127.0.0.1:5283 KEYSPACE_PORT=5283 docker compose -p keyspace-capacity-final up -d --build
LOAD_BASE_URL=http://127.0.0.1:5283 LOAD_ALLOW_TEST_DATABASE=yes npm run test:load
```

기본 100명, 600초. localhost HTTP는 검사 전용이며 운영은 HTTPS 필수. 쿠키는 부하 클라이언트의 메모리에서만 유지. 결과는 artifacts/challenge/load-report.json. 모든 경기는 실제 30초와 3초 카운트다운을 기다린 뒤 제출. P95 500ms, 기록 유실/중복/서버 오류 0건을 통과 조건으로 검사.

부하 검사 직후 `node scripts/verify-storage.mjs`로 해당 테스트 프로젝트의 재시작/재생성/온라인 백업/별도 볼륨 복원과 데이터 지문 비교 가능. 5285 포트가 비어 있어야 하며 운영 컨테이너 이름으로 바꾸지 않음.

검사 이후 같은 PUBLIC_ORIGIN/KEYSPACE_PORT 환경에서 `docker compose -p keyspace-capacity-final stop`으로 정지, 볼륨은 재시작 확인용으로 보존 가능. 같은 DB에 재실행하면 IP별 신규 참가자 제한 120명/시간에 걸릴 수 있으므로 새 프로젝트/포트 사용. 제한 해제로 운영 검증을 대체하지 않음.

## 모니터링과 한계

- /api/health, 5xx 비율, P95, 프로세스 RSS, DB/백업 디스크 사용량과 여유 공간 확인.
- API 목록은 20개 제한, 진행 중 통신 없음. 오래된 데이터에서 순위 쿼리 시간은 별도 관찰 필요.
- 만료 미완료 티켓은 시간당 정리. 완료 기록은 이용자 삭제 전 누적.
- 쿠키가 없어지면 계정 복구 불가. 닉네임은 공개 표시명이며 인증 수단 아님.
- 클라이언트 편집 이력을 검증하지만 자동 입력과 다중 익명 참가자를 완전 방지하지 않음.
- 로컬 컨테이너 실측은 기존 서버의 실제 운영 트래픽과 네트워크 RTT에 대한 보장이 아님. 전환 후 같은 지표 재확인 필요.
