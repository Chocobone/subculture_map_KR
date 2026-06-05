#!/usr/bin/env bash
# CloudShell 세션 초기화 스크립트
# 사용법: bash setup.sh
#         bash setup.sh --infra-only   (CDK 배포 준비만)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INFRA_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--infra-only" ]] && INFRA_ONLY=true
done

# 리전 고정 (CloudShell 기본값 ap-southeast-2 덮어쓰기)
export AWS_DEFAULT_REGION=ap-northeast-2
export CDK_DEFAULT_REGION=ap-northeast-2

echo "=== subculture-tracker 의존성 설치 ==="
echo "루트: $ROOT_DIR"
echo "리전: $AWS_DEFAULT_REGION"
echo

install_pkg() {
  local dir="$1"
  echo ">>> npm install: $dir"
  (cd "$dir" && npm install --prefer-offline 2>&1 | tail -3)
  echo
}

install_pkg "$ROOT_DIR/infra"
install_pkg "$ROOT_DIR/backend/api"
install_pkg "$ROOT_DIR/backend/crawler"

if [[ "$INFRA_ONLY" == false ]]; then
  install_pkg "$ROOT_DIR/frontend"
fi

echo "=== 완료 ==="
echo
echo "다음 명령어로 배포하세요:"
echo "  cd $ROOT_DIR/infra"
echo "  npx cdk deploy --all --context env=dev"
