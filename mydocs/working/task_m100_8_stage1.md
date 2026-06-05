# Stage 1 완료 보고서 — Task M100 #8
## VpcNetwork NAT Instance 전환

> 완료일: 2026-06-05  
> 브랜치: `local/task8`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/constructs/VpcNetwork.ts` | `VpcNetworkProps` 인터페이스 추가, `natGatewayProvider` prop 수신 |
| `infra/lib/stacks/data-stack.ts` | NAT provider 환경별 생성 후 VpcNetwork에 주입 |

---

## 상세 변경 내용

### VpcNetwork.ts

- `VpcNetworkProps { natGatewayProvider?: NatProvider }` 인터페이스 신설
- 생성자 시그니처: `constructor(scope, id)` → `constructor(scope, id, props: VpcNetworkProps = {})`
- `new Vpc()` 에 `natGatewayProvider: props.natGatewayProvider` 전달
  - `undefined` 전달 시 CDK 기본값(NAT Gateway) 동작 — prod 환경 영향 없음

### data-stack.ts

- `NatProvider`, `InstanceType`, `InstanceClass`, `InstanceSize` import 추가
- `isProd` 분기:
  - **prod**: `undefined` → CDK 기본 NAT Gateway 유지
  - **dev**: `NatProvider.instance({ instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO) })`
- `VpcNetwork` 생성자 호출에 `{ natGatewayProvider }` 전달

---

## 검증

- `npx tsc --noEmit` — 타입 오류 없음 (출력 없음)

---

## 예상 cdk diff (dev 환경)

```
[-] AWS::EC2::NatGateway  Network/Vpc/PublicSubnet1/NATGateway  제거
[-] AWS::EC2::EIP          (NatGateway용 EIP)                   제거
[+] AWS::EC2::Instance     Network/Vpc/NatInstance              추가 (t2.micro)
[+] AWS::EC2::EIP          (NatInstance용 EIP)                  추가
[~] AWS::EC2::Route        PrivateSubnet/DefaultRoute           변경 (GatewayId → InstanceId)
```

prod 환경(`--context env=prod`)에서는 변경 없음.

---

*Stage 2 진행 대기 — 작업지시자 승인 요청*
