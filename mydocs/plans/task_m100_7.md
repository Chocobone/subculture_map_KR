# 수행 계획서 — M100 #7 Frontend 배포 스택 + 도메인 연결 + 전체 dev 배포

| 항목 | 내용 |
|------|------|
| 마일스톤 | M100 (v1.0.0) |
| 이슈 | #7 |
| 작성일 | 2026-06-04 |
| 상태 | 승인 대기 |

---

## 목표

AWS dev 환경에 전체 스택을 배포하고 `subculture.chocobone.dev` 도메인을 연결한다.

---

## 배경

- #1~#6 완료로 코드베이스는 완성 상태
- `infra/`에 DataStack·ApiStack·CrawlerStack은 구현되어 있으나 FrontendStack 미존재
- `cdk.json`에 domainName 미설정 상태
- `subculture.chocobone.dev`는 Route53 미등록 (타 등록기관 또는 상위 도메인 `chocobone.dev` 관리 중)

---

## 범위

### 포함

1. `infra/lib/stacks/frontend-stack.ts` 신규 생성
   - S3 버킷 (정적 호스팅)
   - CloudFront 배포 (OAC + HTTPS 강제)
   - ACM 인증서 (`subculture.chocobone.dev`, **us-east-1** 리전)
   - Route53 Hosted Zone (`subculture.chocobone.dev`) + A 레코드
2. `infra/bin/app.ts` — FrontendStack 추가
3. `infra/cdk.json` — domainName, hostedZoneName 컨텍스트 추가
4. dev 전체 스택 배포 (Data → Api → Crawler → Frontend 순서)
5. Route53 NS 레코드 취득 → `chocobone.dev` 등록기관에 NS 위임 설정
6. 도메인 접속 최종 확인 + `frontend/.env.local` VITE_API_URL 업데이트

### 미포함 (백로그)

- prod 환경 배포
- CloudFront WAF, 커스텀 에러 페이지 세부 설정
- CI/CD 파이프라인 연동

---

## 도메인 연결 전략

`subculture.chocobone.dev`는 `chocobone.dev`의 서브도메인이다.
Route53에 `subculture.chocobone.dev` 전용 Hosted Zone을 생성하고,
상위 도메인(`chocobone.dev`) 관리처에 아래 NS 레코드를 위임 등록하는 방식을 사용한다.

```
subculture.chocobone.dev  NS  <Route53 Hosted Zone NS 4개>
```

ACM 인증서는 DNS 검증 방식으로 발급하며, CloudFront 배포가 있는
**us-east-1** 리전에서 생성한다 (CloudFront 요구 사항).

---

## 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| ACM 인증서가 us-east-1에 있어야 함 | CDK Stack region을 us-east-1로 cross-region 분리 또는 DnsValidatedCertificate 사용 |
| DNS 전파 시간 (최대 48h) | NS 등록 즉시 CloudFront URL로 우선 동작 확인 |
| Aurora Cold Start (Serverless v2 0.5 ACU) | 최초 API 호출 지연 예상, 운영 이슈 아님 |
| 비용 발생 시작 | Aurora $15~30/월, CloudFront 무료 한도 내 예상 |

---

## 스택 배포 순서

```
DataStack → ApiStack → CrawlerStack → FrontendStack
```

DataStack이 Aurora·Secrets를 생성하므로 반드시 먼저 배포해야 한다.
FrontendStack은 ApiStack의 API Gateway URL을 참조하므로 ApiStack 이후에 배포한다.

---

## 완료 기준

- [ ] `https://subculture.chocobone.dev` 에서 프론트엔드 정상 접속
- [ ] `GET https://subculture.chocobone.dev/api/events` 200 응답
- [ ] HTTPS 인증서 유효 (브라우저 자물쇠 표시)
- [ ] CloudFront → S3 OAC 정책으로 직접 S3 URL 차단 확인
