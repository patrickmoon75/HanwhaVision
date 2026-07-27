# [한화비전 RWCS] Supabase 데이터 자동 적재 API 연동 가이드

본 문서는 한화비전 RWCS(창고 관리 및 로봇 제어 시스템)에서 일별 생성/업데이트되는 창고 운영 데이터를 **Supabase DB**로 매일 1회 연동하기 위한 백엔드 개발자용 API 연동 가이드입니다.

---

## 1. Supabase 접속 정보 (Credentials)

외부 시스템(RWCS 백엔드 또는 Batch Server)에서 데이터 적재 작업을 수행할 때 필요한 인증 정보입니다.

* **Project URL**: `https://[YOUR_PROJECT_REF].supabase.co`
* **Secret Key (service_role)**: `sb_secret_[YOUR_SECRET_KEY]`
  > ⚠️ **보안 주의**: `Secret Key`는 DB의 RLS(Row Level Security)를 우회하여 데이터 쓰기/수정이 가능한 강력한 권한을 가집니다. 외부로 노출되지 않도록 서버 환경변수(`ENV`)로 안전하게 관리해 주세요.

---

## 2. 연동 대상 테이블 구조 (4개 테이블)

모든 테이블은 **Upsert(Insert or Update)** 방식으로 처리할 수 있도록 구성되어 있습니다.

### ① 배치계획 (`batch_plans`)
* **엔드포인트**: `POST {URL}/rest/v1/batch_plans`
* **컬럼 명세**:
  * `PlanId` (TEXT) : 배치 플랜 ID
  * `Rank` (TEXT / INT) : 순위
  * `Score` (TEXT / INT) : 스코어
  * `TargetPalletQuantity` (TEXT / INT) : 목표 파렛트 수량
  * `ItemId` (TEXT) : 품목 코드
  * `OrderCount` (TEXT / INT) : 주문 수량
  * `OutboundQuantity` (TEXT / INT) : 출고 수량 (쉼표 제거 후 입력 권장)
  * `ItemVolume` (TEXT / NUMERIC) : 품목 체적
  * `DailyMaxQuantity` (TEXT / INT) : 일일 최대 수량
  * `DailyAverageQuantity` (TEXT / INT) : 일일 평균 수량

### ② 미션로그 (`mission_logs`)
* **엔드포인트**: `POST {URL}/rest/v1/mission_logs`
* **컬럼 명세**:
  * `Uuid` (TEXT, PK) : 고유 식별자 (UUID)
  * `MissionId` (TEXT) : 미션 ID
  * `MissionType` (TEXT) : 미션 유형 (YardExtract 등)
  * `MissionGroupId` (TEXT) : 미션 그룹 ID
  * `RunType` (TEXT) : 주행 유형 (Normal 등)
  * `FromLocation` (TEXT) : 출발 로케이션
  * `ToLocation` (TEXT) : 도착 로케이션
  * `PalletId` (TEXT) : 파렛트 ID
  * `Items` (TEXT) : 품목 리스트
  * `TargetItem` (TEXT) : 대상 품목
  * `Quantity` (TEXT / NUMERIC) : 수량
  * `State` (TEXT) : 상태 (Completed, Failed 등)
  * `Message` (TEXT) : 메시지
  * `RobotId` (TEXT / NUMERIC) : 로봇 ID
  * `ChainMissionId` (TEXT) : 연계 미션 ID
  * `CreateTime` (TEXT / TIMESTAMP) : 생성 일시 (`YYYY-MM-DD HH:mm:ss`)
  * `StartTime` (TEXT / TIMESTAMP) : 시작 일시
  * `CompleteTime` (TEXT / TIMESTAMP) : 완료 일시

### ③ 재고현황 (`inventory_status`)
* **엔드포인트**: `POST {URL}/rest/v1/inventory_status`
* **컬럼 명세**:
  * `locationId` (TEXT) : 로케이션 ID
  * `palletId` (TEXT) : 파렛트 ID
  * `itemId` (TEXT) : 품목 ID
  * `holdCode` (TEXT) : 홀드 코드
  * `invType` (TEXT) : 재고 유형
  * `minTrackingDate` (TEXT / TIMESTAMP) : 추적 일시
  * `piecesOnhand` (TEXT / INT) : 보유 수량
  * `Date` (TEXT / DATE) : 기준 일자 (`YYYY-MM-DD`)

### ④ 피킹오더 (`picking_orders`)
* **엔드포인트**: `POST {URL}/rest/v1/picking_orders`
* **컬럼 명세**:
  * `ReceiveTime` (TEXT / TIMESTAMP) : 수신 일시 (`YYYY-MM-DD HH:mm:ss`)
  * `PicktaskId` (TEXT) : 피킹 태스크 ID
  * `DoId` (TEXT) : 출고 지시서 ID (DO ID)
  * `LocationId` (TEXT) : 로케이션 ID
  * `ItemId` (TEXT) : 품목 ID
  * `ItemQty` (TEXT / INT) : 피킹 수량

---

## 3. HTTP REST API 요청 사양 (Headers)

모든 API 요청 시 아래의 **Common Headers**를 필수 포함해야 합니다.

```http
Content-Type: application/json
apikey: <SUPABASE_SECRET_KEY>
Authorization: Bearer <SUPABASE_SECRET_KEY>
Prefer: resolution=merge-duplicates
```
> 💡 `Prefer: resolution=merge-duplicates` 헤더를 포함하면, 기존 PK 데이터가 존재하는 경우 자동으로 **Upsert(업데이트)** 처리됩니다.

---

## 4. 연동 코드 샘플

### A. Python 연동 예시 (Requests 패키지 사용)

```python
import requests
import json

SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "sb_secret_your_secret_key"

headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "resolution=merge-duplicates"
}

# 예시 데이터: 재고현황 (inventory_status)
data = [
    {
        "locationId": "A161",
        "palletId": "A069718",
        "itemId": "XRN-420S/VUS",
        "holdCode": None,
        "invType": "CFC8",
        "minTrackingDate": "2026-06-01 05:00:00",
        "piecesOnhand": "38",
        "Date": "2026-06-01"
    }
]

# API 호출 (POST)
endpoint = f"{SUPABASE_URL}/rest/v1/inventory_status"
response = requests.post(endpoint, headers=headers, data=json.dumps(data))

if response.status_code in [200, 201]:
    print("Successfully synced data to Supabase!")
else:
    print(f"Failed to sync: {response.status_code} - {response.text}")
```

### B. Node.js (cURL / Fetch) 연동 예시

```javascript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_KEY = "sb_secret_your_secret_key";

async function syncPickingOrders(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/picking_orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    console.log("Picking orders synced successfully!");
  } else {
    console.error("Error syncing data:", await response.text());
  }
}
```

---

## 5. 데이터 정제 및 동기화 권장사항

1. **배치 실행 주기**: 하루 1회 (예: 매일 자정 또는 익일 새벽 02:00) 배치 스크립트로 전송 권장.
2. **숫자 및 날짜 수치 정제**:
   * 수량 등 숫자 필드에 천 단위 쉼표(`,`)나 여백이 포함된 경우 쉼표를 제거(`2751`)한 후 전송하는 것을 권장합니다.
   * 날짜 필드의 경우 `YYYY-MM-DD` 또는 `YYYY-MM-DD HH:mm:ss` 표준 포맷으로 전송해 주세요.
3. **대량 적재 (Batch Insert)**: 데이터를 전송할 때 1건씩 보낼 필요 없이 JSON Array 형태(`[...]`)로 한 번에 최대 1,000~5,000건씩 묶어서 전송하면 전송 속도가 대폭 향상됩니다.
