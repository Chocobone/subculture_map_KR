# 수행 계획서 — M100 #2: Aurora 스키마 마이그레이션 + Lambda API CRUD

## 1. 목표

Aurora PostgreSQL에 행사·IP·유저·구독 테이블을 생성하고,
Lambda API 핸들러(GET/POST /events, GET/POST /ips)를 구현한다.

## 2. 범위

- **포함**: Aurora 마이그레이션 SQL, Lambda CRUD 핸들러, ElastiCache 캐시 래퍼
- **제외**: OpenSearch 연동, 알림 발송 (별도 이슈)

## 3. 구현 단계 (구현 계획서에서 상세화)

1. Aurora 스키마 마이그레이션 파일 작성
2. Lambda API 핸들러 구현 (events, ips)
3. CDK ApiStack에 Lambda 함수 등록
4. SAM Local로 로컬 테스트
5. dev 스택 배포 + 통합 테스트

## 4. 완료 기준

- `npm run test -ws` 통과
- SAM Local에서 GET /events, POST /events 정상 응답
- dev 스택 배포 후 API Gateway에서 실제 호출 성공

## 5. 작업지시자 승인 요청

위 계획으로 진행해도 될까요?
