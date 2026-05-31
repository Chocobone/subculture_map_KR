# Backend / Notifier — Claude Code Guide

Aurora에 신규 행사가 등록되면 트리거되는 알림 발송 Lambda입니다.
SNS 팬아웃으로 이메일(SES)과 WebSocket 실시간 푸시 두 채널을 동시에 지원합니다.

> **Hyper-Waterfall 적용**: 알림 채널 추가·수정 전 수행 계획서를 작성하고 승인을 받아야 합니다.

---

## 디렉토리 구조

```
backend/notifier/src/
├── handler.ts                  ← EventBridge 트리거 핸들러
├── channels/
│   ├── SesChannel.ts           ← 이메일 발송 (SES)
│   └── WebSocketChannel.ts     ← WebSocket 푸시 (PostToConnection)
├── services/
│   ├── subscriptionService.ts  ← 구독자 목록 조회 (Aurora)
│   └── snsService.ts           ← SNS 팬아웃 토픽 발행
└── templates/
    └── newEvent.html           ← SES 이메일 HTML 템플릿
```

---

## 핵심 패턴

### 알림 핸들러

```typescript
// handler.ts
import { EventBridgeHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { subscriptionService } from './services/subscriptionService';
import { snsService } from './services/snsService';
import type { Event } from '../../../shared/types';

const logger = new Logger({ serviceName: 'notifier' });

// 트리거: eventService.upsert() 완료 후 API Lambda가 EventBridge에 발행
export const handler: EventBridgeHandler<'EventCreated', Event, void> = async (event) => {
  const newEvent = event.detail;
  logger.info('신규 행사 알림 시작', { eventId: newEvent.id, ipName: newEvent.ipName });

  const subscribers = await subscriptionService.getByIP(newEvent.ipId);
  if (subscribers.length === 0) {
    logger.info('구독자 없음, 알림 생략', { ipId: newEvent.ipId });
    return;
  }

  await snsService.publish(newEvent.ipId, {
    eventId:    newEvent.id,
    title:      newEvent.title,
    type:       newEvent.type,
    place:      newEvent.place,
    startDate:  newEvent.startDate,
    endDate:    newEvent.endDate,
    ipName:     newEvent.ipName,
    deepLink:   `${process.env.APP_URL}/events/${newEvent.id}`,
    subscribers: subscribers.map(s => s.email),
  });
};
```

### SNS 팬아웃

```typescript
// services/snsService.ts
// IP별 SNS 토픽으로 발행 → SES + WebSocket 구독자에게 동시 팬아웃
const topicArn = `${process.env.SNS_TOPIC_ARN_PREFIX}:ip-${ipId}`;
```

### WebSocket 푸시 (끊긴 연결 자동 정리)

```typescript
// channels/WebSocketChannel.ts
try {
  await this.apigw.send(new PostToConnectionCommand({ ConnectionId, Data }));
} catch (e: any) {
  if (e.statusCode === 410) {
    // 연결이 끊긴 connectionId → DynamoDB에서 자동 삭제
    await dynamo.send(new DeleteItemCommand({ ... }));
  }
}
```

---

## 환경 변수

```bash
SNS_TOPIC_ARN_PREFIX=arn:aws:sns:ap-northeast-2:123456789012
WS_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-2.amazonaws.com/prod
WS_CONNECTION_TABLE=ws-connections
SES_FROM_ADDRESS=noreply@subculture-tracker.com
APP_URL=https://subculture-tracker.com
DB_SECRET_ARN=arn:aws:secretsmanager:...
AWS_REGION=ap-northeast-2
```

---

## 알림 채널 추가 시 절차 (Hyper-Waterfall)

1. GitHub Issue 등록 (채널명, 발송 방식, 필요한 AWS 서비스 명시)
2. `mydocs/plans/task_{m}_{N}.md` 수행 계획서 → 승인
3. `mydocs/plans/task_{m}_{N}_impl.md` 구현 계획서 작성
   - `channels/NewChannel.ts` 신규 생성
   - `handler.ts`에서 채널 호출 추가
   - `infra/lib/stacks/notifier-stack.ts`에 SNS 구독 리소스 추가
   - 필요한 환경 변수 추가
4. 단계별 구현 → 보고 → 승인 → 최종 보고
