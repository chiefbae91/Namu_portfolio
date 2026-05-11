# Portfolio Dashboard (Next.js)

Robinhood + JP Morgan 통합 포트폴리오 대시보드

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev

# 3. 브라우저에서 접속
http://localhost:3000
```

## 최초 실행 순서

1. `http://localhost:3000` 접속
2. AUTHENTICATE 버튼 클릭 (생체인증)
3. ⚙️ SETTINGS 에서 자격증명 입력
   - Robinhood 이메일 + 비밀번호
   - Plaid Client ID + Secret + Access Token
4. SAVE TO KEYCHAIN 클릭 → OS 키체인에 암호화 저장
5. MANUAL SYNC 패널에서 계좌 동기화

## 폴더 구조

```
portfolio-next/
├── app/
│   ├── page.js                      # 메인 대시보드
│   ├── layout.js
│   ├── globals.css
│   └── api/
│       ├── portfolio/route.js        # 포트폴리오 데이터
│       ├── sync/route.js             # 계좌 동기화
│       ├── auth/credentials/route.js # 자격증명 관리
│       └── market/history/route.js   # 히스토리 데이터
├── components/
│   ├── StatusBar.js                  # 장 상태 표시
│   ├── SummaryPanel.js               # FX/Total/Last/Change
│   ├── PortfolioTable.js             # 종목 테이블
│   ├── HistoryChart.js               # 히스토리 그래프
│   ├── SyncPanel.js                  # 수동 동기화 버튼
│   └── SetupModal.js                 # 자격증명 설정
├── lib/
│   ├── auth/credentials.js           # OS 키체인 (keytar)
│   ├── core/
│   │   ├── marketData.js             # Yahoo Finance API
│   │   └── portfolio.js              # 계산 엔진
│   └── db/database.js                # SQLite (better-sqlite3)
└── data/
    └── portfolio.db                  # 자동 생성
```

## 보안

- 자격증명: OS 키체인 (keytar)
- 데이터: 로컬 SQLite
- 외부 서버 없음, .env 파일 없음
- 로컬호스트에서만 실행
