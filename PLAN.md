# InteliStock — Implementation Plan

> **Living document.** Claude는 작업을 시작하거나 마칠 때마다 이 파일을 먼저 읽고, 해당 작업의 체크박스/상태를 갱신해야 함. 새로운 결정이 생기면 본문도 함께 수정.

**Last updated:** 2026-04-28
**Repo:** https://github.com/hms-gymnopedie/Inteli_Stocks
**Local root:** `/Users/gymnopedie/260428_InteliStock`
**App root:** `app/` (Vite + React 18 + TypeScript)

---

## How to use this doc

1. 작업 시작 전: 이 파일을 읽고 다음 우선순위(👉 표시)와 의존성(blocks/blocked-by)을 확인.
2. 작업 중: 해당 task 상태를 🟡로 변경하고 commit 메시지에 task ID(예: `B1-OV-2`) 포함.
3. 작업 끝: ✅로 변경, "Notes" 컬럼에 결정/트레이드오프 한 줄 기록, 푸시.
4. 새 task가 생기면 해당 배치(B#) 표 아래에 행 추가. 배치 자체가 새로 필요하면 §3에 새 섹션 추가.
5. 페이즈 전환 시 §6 "Current state" 갱신.

### Status legend
- ⬜ todo
- 🟡 in progress
- ✅ done
- ⏸ blocked / paused (사유는 Notes)
- 🚫 dropped (사유는 Notes)

---

## 1. Phase 0 — Foundations (직렬, 모든 후속 작업의 prerequisite)

이 셋이 끝나기 전에는 페이지 작업을 병렬로 돌리면 무조건 충돌남.

| ID | Task | 산출물 | Agent | Status | Notes |
|---|---|---|---|---|---|
| 0-A | 데이터 모델 + mock fetcher 레이어 | `app/src/data/{types.ts, market.ts, portfolio.ts, geo.ts, security.ts, ai.ts}` | backend-api-data-engineer | ⬜ | 모든 섹션의 단일 진입점. 처음엔 mock, 나중에 real adapter로 교체 가능하게 인터페이스 분리 |
| 0-B | 페이지 분해 — 한 파일에 몰린 섹션을 컴포넌트 파일로 쪼개기 | `app/src/pages/overview/*.tsx`, `pages/portfolio/*.tsx`, `pages/geo/*.tsx`, `pages/detail/*.tsx` | frontend-ui-integrator | ⬜ | 이걸 안 하면 같은 페이지 섹션을 두 에이전트가 동시에 못 건듦 |
| 0-C | `lib/format.ts` (가격/퍼센트/통화/시간/timezone) | `app/src/lib/format.ts` | frontend-ui-integrator | ⬜ | 모든 섹션이 공유 |

---

## 2. 페이지별 섹션 상세

### 2.1 Overview (`/overview`)

| Section | Data source | Interactions | New (vs prototype) |
|---|---|---|---|
| IndicesStrip | `market.getIndices()` | 클릭 → Detail 이동 | WS streaming, 셀 단위 flash 애니메이션 |
| HeroChart | `market.getIntraday(symbol, range)` | 1D/1W/1M/3M/YTD/1Y/5Y, hover crosshair, OHLC 툴팁 | crosshair, 가격 라벨, 거래대금 오버레이 |
| SectorHeatmap | `market.getSPConstituents()` | hover/클릭 → 정보·이동 | 진짜 treemap (현재 6열 그리드) |
| SectorFlow | `market.getSectorReturns()` | 정렬 토글 (절대/상대) | 1D/1W/1M 레인지 토글 |
| MacroMonitor | `market.getMacro([...])` | 카드 클릭 → 풀 차트 모달 | 발표 임박 표시(calendar 연동) |
| AISignals | `ai.streamSignals(portfolioId?)` | "Action" → 시뮬레이션 | **Claude API 스트리밍** |
| SentimentGauge | `market.getFearGreed()` | hover → 5인자 breakdown | 어제/1W/1M trail |
| TodaysEvents | `market.getCalendar(today)` | 클릭 → 상세 | 영향도 필터 |
| Watchlist | `portfolio.getWatchlist('KR')` | 추가/제거, 드래그 | 검색 add input |
| SessionVolume | `market.getSessionVolume()` | — | 진짜 timeseries bar |
| Workspaces nav | static | 활성 highlight | **상단 nav와 중복 → 즐겨찾기로 용도 변경 or 제거 결정 필요** |

### 2.2 Portfolio (`/portfolio`)

| Section | Data source | Interactions | New |
|---|---|---|---|
| KPIStrip | `portfolio.getSummary()` | 클릭 → 해당 분석 스크롤 | 비교 기간(1D/WTD/MTD/YTD) |
| EquityCurve | `portfolio.getEquityCurve('1Y')` | 벤치마크 토글, 기간 | drawdown 음영, 입출금 마커 |
| Allocation | `portfolio.getAllocation('sector')` | sector/region/asset 토글 | drill-in (sector→종목) |
| HoldingsTable | `portfolio.getHoldings()` | 정렬·필터·검색·가상 스크롤 | 컬럼 표시/순서 커스터마이즈 |
| AIInsightsFeed | `ai.streamInsights(portfolioId)` | dismiss, hedge 시뮬, 무한 스크롤 | 카테고리 필터(OPP/RISK/MACRO/EARNINGS), 알림 설정 |
| (신규) Trades log | `portfolio.getTrades()` | 기간/심볼 필터 | 펼침/접힘 |
| (신규) Risk decomposition | `portfolio.getRiskFactors()` | factor 클릭 → 기여도 | beta/sector/geo factor exposure |

### 2.3 Geo Risk (`/geo`)

| Section | Data source | Interactions | New |
|---|---|---|---|
| WorldMap | `geo.getRiskMap()` | 팬/줌, 핀 클릭 → 사이드 | **TopoJSON + d3-geo 재구현** (현재 손그림 SVG → 한계) |
| GlobalRiskIndex | `geo.getGlobalIndex()` | 클릭 → 구성 인자 모달 | 1D/1W/1M trail |
| LiveAlertCard | `geo.streamAlerts()` | dismiss, hedge, detail | WS push |
| LayerToggles | local state | 즉시 지도 반영 | 영역별 opacity |
| RiskLegend | static | hover 강조 | — |
| Hotspots ranked | `geo.getHotspots()` | 클릭 → 지도 zoom | 다중 정렬 |
| AffectedPortfolio | `geo.getAffected(portfolioId)` | 종목 클릭 → Detail | 시나리오 P&L (mild/severe) |
| AIHedgeSuggestion | `ai.proposeHedge(exposure)` | "Simulate" → 모달 | **Claude API** |
| (신규) Region drawer | 핀 클릭 시 슬라이드 | 사건 타임라인, 관련 ETF | — |

### 2.4 Detail (`/detail/:symbol`)

> 현재 NVDA 하드코딩 → URL param 다이나믹화.

| Section | Data source | Interactions | New |
|---|---|---|---|
| Header | `security.getProfile(symbol)` | watchlist, trade | logo CDN, ⌘K 검색 |
| MainChart | `security.getOHLC(symbol, range)` | range, study 추가, 그리기 | replay/scrub, 비교 종목 오버레이 |
| RSIPanel | derived | crosshair 동기화 | 30/70 음영 |
| MACDPanel | derived | 동기화 | histogram 진짜 표시 |
| ValuationGrid | `security.getFundamentals(symbol)` | hover → 정의/sector median | metric 별 mini sparkline |
| DisclosuresFeed | `security.getFilings(symbol)` | 클릭 → SEC 원문, AI 요약 | 영향도 자동 점수 |
| AIInvestmentGuide | `ai.getVerdict(symbol)` | "Why?" → 근거 라인 | **Claude API**, 5축 breakdown 클릭 |
| AnalystTargets | `security.getTargets(symbol)` | hover → 분석사 분포 | 시간 trail |
| Peers | `security.getPeers(symbol)` | 클릭 → 그 종목 Detail | 비교 metric 토글 |
| (신규) Earnings & guidance | `security.getEarnings(symbol)` | 분기 클릭 | 컨센 vs 실적 |
| (신규) Options chain mini | `security.getIVSurface(symbol)` | 만기/strike | IV 백분위, skew |

---

## 3. 병렬 작업 배치 (Phase 0 완료 가정)

같은 배치(B#) 안의 task는 파일 충돌이 없어 병렬 실행 가능.

### 배치 B1 — 페이지 분해 직후 가능 (4 task 동시)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B1-OV | Overview 차트 섹션 (HeroChart, SectorHeat, SectorFlow, MacroMonitor, SessionVolume, Watchlist, IndicesStrip, TodaysEvents) | `pages/overview/*.tsx` (AI/Sentiment 제외) | frontend-ui-integrator | ⬜ | |
| B1-PF | Portfolio 표/할당 섹션 (KPIStrip, EquityCurve, Allocation, HoldingsTable) | `pages/portfolio/*.tsx` (AI 피드 제외) | frontend-ui-integrator | ⬜ | |
| B1-DT | Detail 차트 섹션 (MainChart, RSI, MACD, ValuationGrid, AnalystTargets, Peers) | `pages/detail/*.tsx` (AIGuide·Disclosures 제외) | frontend-ui-integrator | ⬜ | |
| B1-GE | GeoRisk 사이드 섹션 (Hotspots, AffectedPortfolio, GlobalRiskIndex, LayerToggles, RiskLegend) | `pages/geo/*.tsx` (지도/AI 제외) | frontend-ui-integrator | ⬜ | |

### 배치 B2 — 도메인 인프라 (B1과 병렬, 다른 디렉토리)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B2-MAP | WorldMap 재구현 (TopoJSON + d3-geo, 줌·팬, 레이어, 핀 클릭) | `app/src/lib/WorldMap/*` | frontend-ui-integrator + general-purpose (TopoJSON 출처 조사) | ⬜ | |
| B2-AI | AI 백엔드 프록시 (Claude API 라우터, 스트리밍, 캐시) | `server/routes/ai/*` (신규 디렉토리, 앱과 분리) | backend-api-data-engineer + claude-api skill | ⬜ | 키 보관 위치, 모델 선택, 스트리밍 형식 결정 필요 |
| B2-MD | Market data adapter (실제 API 후보 조사 + 어댑터 1개) | `app/src/data/providers/*` | backend-api-data-engineer | ⬜ | 후보: Polygon, Finnhub, Alpha Vantage, Yahoo (무료 한도 비교) |
| B2-TW | Tweaks 확장 (timezone, locale, currency, 컬럼설정 영속화) | `app/src/lib/tweaks.tsx` | frontend-ui-integrator | ⬜ | localStorage 영속화 |

### 배치 B3 — AI 의존 섹션 (B2-AI 완료 후)

| ID | Task | 파일 | Agent | Status | Blocks/by | Notes |
|---|---|---|---|---|---|---|
| B3-OV-AI | Overview AISignals + Sentiment | `pages/overview/AISignals.tsx`, `Sentiment.tsx` | frontend-ui-integrator + claude-api | ⬜ | by B2-AI | |
| B3-PF-AI | Portfolio AIInsightsFeed | `pages/portfolio/AIInsightsFeed.tsx` | frontend-ui-integrator + claude-api | ⬜ | by B2-AI | |
| B3-GE-AI | Geo AIHedgeSuggestion + LiveAlerts | `pages/geo/AIHedge.tsx`, `LiveAlerts.tsx` | frontend-ui-integrator + claude-api | ⬜ | by B2-AI | |
| B3-DT-AI | Detail AIInvestmentGuide + Disclosure 요약 | `pages/detail/AIGuide.tsx`, `Disclosures.tsx` | frontend-ui-integrator + claude-api | ⬜ | by B2-AI | |

### 배치 B4 — 횡단 관심사 (B1·B2 끝나면 병렬)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B4-RT | Detail 라우트 다이나믹화 `/detail/:symbol` + ⌘K 검색 | `App.tsx`, `lib/SymbolSearch.tsx` | frontend-ui-integrator | ⬜ | |
| B4-RS | 반응형/모바일 (현재 1100px 이하 sidebar 숨김 → 본격 대응) | 각 페이지 + `styles.css` | frontend-ui-integrator | ⬜ | |
| B4-A11 | 접근성 (포커스 링, ARIA, 키보드 nav, 색대비) | 각 컴포넌트 | frontend-ui-integrator | ⬜ | |
| B4-E2E | Playwright E2E (4 페이지 스모크 + 인터랙션) | `app/tests/*.spec.ts` | document-skills:webapp-testing | ⬜ | |
| B4-CI | GitHub Actions CI (lint + typecheck + build + Playwright) | `.github/workflows/ci.yml` | backend-api-data-engineer | ⬜ | |
| B4-VR | 시각 회귀 (Percy/Chromatic 또는 자체 스크린샷 비교) | `app/tests/visual/*` | document-skills:webapp-testing | ⬜ | |

### 배치 B5 — 사용자/포트폴리오 영속화 (선택)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B5-AU | 인증 (Supabase 또는 Clerk) | `app/src/auth/*` | backend-api-data-engineer | ⬜ | |
| B5-CR | 포트폴리오 CRUD + 동기화 | `server/routes/portfolio/*` | backend-api-data-engineer | ⬜ | |
| B5-NT | 알림/푸시 (이메일/웹훅) | `server/jobs/*` | backend-api-data-engineer | ⬜ | |

### 배치 R — 리뷰 (각 페이즈 종료 시)

| ID | When | Agent | Status |
|---|---|---|---|
| R-P0 | Phase 0 끝나면 | senior-code-reviewer | ⬜ |
| R-P1 | B1+B2 끝나면 | senior-code-reviewer | ⬜ |
| R-P2 | B3 끝나면 | senior-code-reviewer | ⬜ |
| R-P3 | B4 끝나면 | senior-code-reviewer | ⬜ |

---

## 4. 에이전트·Skill 매핑

| Agent / Skill | 사용처 | 빈도 |
|---|---|---|
| **frontend-ui-integrator** | 모든 페이지 섹션, WorldMap, 반응형, A11y | 가장 많음 |
| **backend-api-data-engineer** | 데이터 레이어, AI 프록시, market adapter, CI, 인증 | B0·B2·B4·B5 |
| **claude-api** (skill) | AI가 들어가는 모든 섹션 통합 | B2·B3 |
| **document-skills:webapp-testing** | Playwright E2E + 시각 회귀 | B4 |
| **general-purpose** | TopoJSON 출처, 무료 시장 API 비교 등 리서치 | B2 시작 시 |
| **senior-code-reviewer** | 페이즈 종료마다 PR 리뷰 | 4~5회 |
| **document-skills:frontend-design** | 신규 화면(로그인/온보딩/빈상태) 생기면 | 필요 시 |
| ml-vision-engineer | 도메인 매칭 없음 — 차트 OCR/위성 이미지 추가 시에만 | 사용 안 함 |

---

## 5. 실행 순서 권장

1. **Phase 0 (직렬)** — 0-A → 0-B → 0-C, PR 1개로 머지
2. **Phase 1 (대규모 병렬)** — B1 4개 + B2 4개 = **에이전트 8개 동시**, B2-MD 끝나는 시점에 B1 일부를 mock→real로 전환
3. **Phase 2** — B3 4개 동시 (B2-AI 완료 후)
4. **Phase 3** — B4 6개 동시
5. **Phase 4 (선택)** — B5

각 페이즈 종료마다 R-P# 1회.

---

## 6. Current state

- ✅ **Pre-Phase 0** — Vite+React+TS 스캐폴드, 4 페이지 정적 구현(Overview/Portfolio/Geo/Detail), 디자인 토큰, Tweaks 패널, 라우팅, 빌드 검증, GitHub 연결 (commit `1445063`)
- 👉 **다음**: Phase 0 (0-A → 0-B → 0-C). 사용자 승인 대기 중.

---

## 7. Open questions / decisions needed

- [ ] Workspaces 좌측 nav: 상단 nav와 중복 → 제거 vs 즐겨찾기 패널로 전환?
- [ ] Market data 공급자 (Polygon vs Finnhub vs Alpha Vantage vs Yahoo unofficial) — 무료 한도 비교 후 결정
- [ ] AI 백엔드 호스팅 (Vercel functions vs 별도 Node 서버 vs Cloudflare Workers)
- [ ] 인증 도입 시점 (B5는 선택이지만, 포트폴리오 멀티 디바이스 동기화 필요 여부)
- [ ] Detail 라우트의 `:symbol` 형식 — `NVDA` vs `XNAS:NVDA` (거래소 prefix 포함 여부)
- [ ] 시각 회귀: 외부 SaaS(Percy) vs 자체 Playwright snapshot
