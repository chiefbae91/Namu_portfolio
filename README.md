# Namu Portfolio

개인 주식 포트폴리오 대시보드 — Next.js + Supabase

## 주요 기능

### 포트폴리오
- 다중 계좌 관리 (IRA, Roth IRA, 일반 계좌 등)
- 실시간 주가 조회 (Yahoo Finance)
- 계좌별 수익률 및 총 자산 현황
- 계좌 히스토리 차트 (일별 자산 변동)
- 다중 통화 지원 (KRW, JPY 등 환율 변환)

### 거래 내역
- 매수 / 매도 / 배당 / 현금 이체 기록
- 주식 분할 / 역분할 처리
- CSV 가져오기 지원:
  - **Interactive Brokers** (Activity Statement, Flex Query)
  - **Fidelity** (거래 내역 CSV)
  - **Webull** (주문 내역 CSV)
  - **Robinhood**
  - Generic 포맷
- 중복 거래 자동 감지
- FIFO 방식 로트 계산

### Trading Hints
- 종목별 매수/매도 힌트 메모 (지지, 저항, 매물대 등)
- 힌트 가격 도달 시 알림 설정 (🔔)
- 알림 방향 자동 구분:
  - 벽 / 단기목표 / 장기목표 → 가격 **이상** 시 알림
  - 그 외 → 가격 **이하** 시 알림
- 알림 발생 시 토스트 팝업 + 헤드 벨 아이콘 뱃지
- 사용자당 최대 20개 알림

### 기타
- 다크 / 라이트 테마
- 앱 이름 커스터마이징 (저장 유지)
- 워치리스트
- 모바일 반응형

## 기술 스택

| 항목 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 인증 / DB | Supabase |
| 스타일 | CSS Variables (커스텀) |
| 차트 | 커스텀 SVG |
| 주가 데이터 | Yahoo Finance API |
| CSV 파싱 | PapaParse |

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local에 Supabase URL, anon key, service role key 입력

# 3. 로컬 개발 서버 실행
npm run dev

# 4. 브라우저 접속
http://localhost:3000
```

## 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Supabase 마이그레이션

`supabase/migrations/` 폴더의 SQL 파일을 Supabase 대시보드 SQL Editor에서 순서대로 실행:

| 파일 | 내용 |
|---|---|
| `add_price_alerts.sql` | 가격 알림 테이블 (`price_alerts`, `hint_notifications`) |
| `add_user_settings.sql` | 사용자 설정 테이블 (`user_settings`) |

## 폴더 구조

```
├── app/
│   ├── page.tsx                        # 메인 대시보드
│   └── api/
│       ├── portfolio/                  # 포트폴리오 데이터
│       ├── transactions/               # 거래 내역 CRUD
│       ├── csv-import/                 # CSV 가져오기 (IB/Fidelity/Webull/RH)
│       ├── trading-hints/              # Trading Hints CRUD
│       ├── alerts/                     # 가격 알림 설정
│       ├── alerts/notifications/       # 알림 내역
│       ├── check-prices/               # 가격 체크 및 알림 발송
│       ├── account-history/            # 계좌 히스토리 차트
│       └── settings/                   # 사용자 설정 (앱 이름 등)
├── components/
│   ├── tabs/
│   │   ├── TradingHints.tsx            # Trading Hints 탭
│   │   └── TransactionHistory.tsx      # 거래 내역 탭
│   ├── modals/
│   │   ├── TransactionModal.tsx        # 거래 추가 / CSV 가져오기
│   │   └── TradingHintModal.tsx        # Trading Hint 추가 / 수정
│   ├── AlertBell.tsx                   # 헤더 알림 벨
│   ├── PriceAlertToasts.tsx            # 알림 토스트 팝업
│   ├── StockChart.tsx                  # 종목 분석 차트
│   └── ThemeToggle.tsx                 # 테마 전환
└── lib/
    ├── types.ts                        # 공통 타입 정의
    ├── supabase-admin.ts               # Supabase 서버 클라이언트
    └── auth.ts                         # 인증 헬퍼
```
