# Stage 1 완료 보고서 — Task M100 #11
## data-stack.ts: 양 환경 NAT Instance 교체

> 완료일: 2026-06-05  
> 브랜치: `local/task11`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/data-stack.ts` | NAT provider 단일 블록으로 통합, dev t3.nano / prod t3.micro |
| `infra/lib/constructs/VpcNetwork.ts` | 주석 업데이트 |

---

## 상세 변경 내용

### data-stack.ts

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| prod NAT | `undefined` (CDK 기본 NAT Gateway) | `NatInstanceProviderV2` t3.micro |
| dev NAT | `NatInstanceProviderV2` t3.micro | `NatInstanceProviderV2` t3.nano |
| 코드 구조 | `isProd ? undefined : new NatInstanceProviderV2(...)` | 단일 `new NatInstanceProviderV2({ instanceType: isProd ? t3.micro : t3.nano })` |

```typescript
// 변경 후
const natGatewayProvider = new NatInstanceProviderV2({
  instanceType: isProd
    ? InstanceType.of(InstanceClass.T3, InstanceSize.MICRO)
    : InstanceType.of(InstanceClass.T3, InstanceSize.NANO),
});
```

---

## 검증

- `npx tsc --noEmit` — **오류 0건**

---

## 예상 cdk diff

**dev 환경**
```
[~] AWS::EC2::Instance  Network/Vpc/NatInstance
    [-] InstanceType: t3.micro
    [+] InstanceType: t3.nano
```

**prod 환경**
```
[-] AWS::EC2::NatGateway  Network/Vpc/PublicSubnet1/NATGateway  제거
[-] AWS::EC2::EIP         (NatGateway용 EIP)                    제거
[+] AWS::EC2::Instance    Network/Vpc/NatInstance               추가 (t3.micro, AL2023)
[~] AWS::EC2::Route       PrivateSubnet/DefaultRoute            변경
```

---

## 비용 영향

| 환경 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| dev | ~$9.93/월 (t3.micro) | ~$4.31/월 (t3.nano) | -$5.62/월 |
| prod | ~$35.00/월 (NAT Gateway) | ~$9.93/월 (t3.micro) | -$25.07/월 |

---

*Stage 2 진행 대기 — 작업지시자 승인 요청*
