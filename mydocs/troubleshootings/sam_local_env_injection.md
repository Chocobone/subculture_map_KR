# 트러블슈팅: SAM CLI --env-vars 환경변수 주입 실패

## 발생 일시

2026-06-02

## 증상

`sam local invoke` 또는 `sam local start-api` 실행 시 `--env-vars env.json`으로 지정한
환경변수가 Lambda 컨테이너에 전달되지 않음.

```bash
sam local invoke GetIPsFunction --event events/getIPs.json --env-vars env.json
# → "The security token included in the request is invalid" (Secrets Manager 호출)
# 원인: process.env.DB_PASSWORD가 undefined → Secrets Manager 경로 진입
```

## 원인

SAM CLI 1.161.1이 Docker 데몬 통신 시 API 버전 협상에서 fallback 발생:

```
WARNING: client version 1.35 is too old. Minimum supported API version is 1.40
→ Fall back docker api version to 1.44
```

이 fallback 경로에서 `--env-vars` JSON의 함수별 환경변수가
Docker `run --env` 인자로 정상 변환되지 않는 버그.

SAM debug 로그는 `"Environment variables data found for specific function in standard format"`를
출력하지만 실제 컨테이너에는 전달 안 됨.

## 해결 방법 (로컬 테스트)

SAM `start-api` / `invoke` 대신 Lambda 런타임 이미지를 **Docker로 직접 실행**:

```bash
# Lambda 이미지 직접 실행
docker run --rm \
  -v "$(pwd)/.aws-sam/build/GetIPsFunction:/var/task:ro" \
  -e DB_HOST=172.17.0.1 \
  -e DB_PORT=5433 \
  -e DB_NAME=subculture_tracker \
  -e DB_USER=postgres \
  -e DB_PASSWORD=password \
  -e REDIS_URL=redis://172.17.0.1:6380 \
  -e AWS_REGION=ap-northeast-2 \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -p 9001:8080 \
  public.ecr.aws/lambda/nodejs:20-rapid-x86_64 "getIPs.handler" &

# Lambda Runtime Interface로 호출
curl -X POST http://localhost:9001/2015-03-31/functions/function/invocations \
  -d '<APIGatewayProxyEvent JSON>'
```

**Linux 환경에서 host.docker.internal 대신 Docker bridge IP 사용**:
```bash
DOCKER_HOST_IP=$(ip addr show docker0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)
# 보통 172.17.0.1
```

## 근본 해결 (선택)

1. SAM CLI 업그레이드 (차기 버전에서 수정 예정)
2. `samconfig.toml`에 `--env-vars` 대신 개별 Lambda 환경변수를 설정
3. 단위 테스트로 대체 (이미 Jest mock 테스트 커버 중)

## 재발 방지

- 로컬 SAM 테스트 시 Docker 직접 실행 방식 사용
- 추후 SAM CLI 버전 업그레이드 후 `--env-vars` 동작 재확인
