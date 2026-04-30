# InteliStock — Implementation Plan

> **Living document.** Claude는 작업을 시작하거나 마칠 때마다 이 파일을 먼저 읽고, 해당 작업의 체크박스/상태를 갱신해야 함. 새로운 결정이 생기면 본문도 함께 수정.

**Last updated:** 2026-04-30 (B2-MD2 + B3 + B4-RT 병렬 완료 — Yahoo 안정화, AI UI 7섹션, /detail/:symbol + ⌘K)
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

> **Phase 0은 실제 데이터를 수집하지 않는다.** 타입 + 함수 시그너처 + mock fetcher만 만들어 UI 작업(B1)과 어댑터 작업(B2-MD)을 디커플링한다. 페이지는 `data/*.ts`만 호출하고, B2-MD에서 mock → 실제 fetch로 함수 본문만 swap.

### Task 0-A — 데이터 레이어 (타입 + mock)

**Agent:** backend-api-data-engineer · **Status:** ✅

| Sub-ID | 산출물 | 내용 | Notes |
|---|---|---|---|
| 0-A.1 | `app/src/data/types.ts` | 30+ 도메인 타입 (`Quote`, `Index`, `OHLC`, `MacroIndicator`, `SectorReturn`, `Constituent`, `FearGreed`, `CalendarEvent`, `Holding`, `AllocationSlice`, `EquityPoint`, `AIInsight`, `AISignal`, `AIVerdict`, `RiskHotspot`, `RiskMapEntry`, `RiskAlert`, `AffectedHolding`, `SecurityProfile`, `Fundamental`, `Filing`, `AnalystTarget`, `Peer`, `Earnings`, `Range`, `MacroKey` 등) | ✅ 36 types, no `any`, strict TS; added `Direction`, `ImpactLevel`, `MapLayer`, `HedgeProposal`, `IVSurfacePoint`, `ConvictionAxis`, `FlowLine` as needed by fetchers |
| 0-A.2 | `app/src/data/market.ts` | `getIndices()`, `getIntraday(sym,range)`, `getSPConstituents()`, `getSectorReturns(range)`, `getMacro(keys)`, `getCalendar(date)`, `getFearGreed()`, `getSessionVolume()`, `getSearch(q)` — 모두 mock Promise | ✅ Data verbatim from TICKER_STRIP, KR_WATCH, HeatGrid cells, SectorBars, Macro Monitor, calendar events in Overview.tsx |
| 0-A.3 | `app/src/data/portfolio.ts` | `getSummary()`, `getEquityCurve(range)`, `getAllocation(by)`, `getHoldings()`, `getWatchlist(region)`, `getTrades()`, `getRiskFactors()` | ✅ HOLDINGS, HEADER_KPIS, allocation bars from Portfolio.tsx; `getWatchlist` kept here for portfolioId scoping, mirrors market version |
| 0-A.4 | `app/src/data/geo.ts` | `getRiskMap()`, `getGlobalIndex()`, `getHotspots()`, `getAffected(portfolioId)`, `streamAlerts()` (AsyncIterable) | ✅ HOTSPOTS, AFFECTED, LAYERS, heat/pins/flows, alert text from GeoRisk.tsx; added `getLayers()` helper; streamAlerts finite cycle |
| 0-A.5 | `app/src/data/security.ts` | `getProfile(symbol)`, `getOHLC(symbol,range)`, `getFundamentals(symbol)`, `getFilings(symbol)`, `getTargets(symbol)`, `getPeers(symbol)`, `getEarnings(symbol)`, `getIVSurface(symbol)` | ✅ VALUATION, FILINGS, PEERS, analyst targets, NVDA header from Detail.tsx; OHLC + IV surface are synthetic generators |
| 0-A.6 | `app/src/data/ai.ts` | `streamSignals()`, `streamInsights(portfolioId)`, `proposeHedge(exposure)`, `getVerdict(symbol)` — 모두 AsyncIterable, mock 단계에선 setTimeout으로 toy stream | ✅ Signal/insight text from Overview/Portfolio.tsx; conviction axes from Detail.tsx; hedge proposal from GeoRisk.tsx; finite streams (yield-once-through) |

Mock 데이터 출처는 현재 페이지에 하드코딩된 값 (Overview/Portfolio/Geo/Detail tsx에 박힌 배열들)을 그대로 끌어올림.

### Task 0-B — 페이지 분해

**Agent:** frontend-ui-integrator · **Status:** ✅

> **Notes (2026-04-28):** 4 monolithic page files (1771 LOC) → 33 section files + 4 `index.tsx` shells (1984 LOC, +213 from per-file headers/imports). Visual output identical — wrapping grids and asides preserved in `index.tsx`, panels and content moved into named sections. Hardcoded data arrays kept inline pending 0-A. `npm run build` passes.

한 파일에 몰린 섹션을 컴포넌트 파일로 분리 (B1 병렬 작업의 충돌 제거):

| Page | 분해 대상 (file 수) | 디렉토리 |
|---|---|---|
| Overview | 11개 (IndicesStrip, Workspaces, Watchlist, HeroChart, SectorHeat, SectorFlow, MacroMonitor, AISignals, Sentiment, TodaysEvents, SessionVolume) | `app/src/pages/overview/` |
| Portfolio | 5개 (KPIStrip, EquityCurve, Allocation, HoldingsTable, AIInsightsFeed) | `app/src/pages/portfolio/` |
| GeoRisk | 8개 (WorldMap*, GlobalRiskIndex, LiveAlertCard, LayerToggles, RiskLegend, Hotspots, AffectedPortfolio, AIHedgeSuggestion) | `app/src/pages/geo/` |
| Detail | 9개 (Header, MainChart, RSIPanel, MACDPanel, ValuationGrid, DisclosuresFeed, AIInvestmentGuide, AnalystTargets, Peers) | `app/src/pages/detail/` |

\* WorldMap 컴포넌트 자체는 `app/src/lib/WorldMap/` (B2-MAP에서 재구현됨).

### Task 0-C — `lib/format.ts`

**Agent:** main · **Status:** ✅

> **Notes (2026-04-28):** 10 pure formatters in `app/src/lib/format.ts`: `formatPrice`, `formatPct`, `formatBp`, `formatVol`, `formatTime`, `formatDateShort`, `formatCurrency`, `formatRange`, `formatChange`, `formatWeight`. Uses typographic minus (U+2212) to match prototype. KRW/JPY auto-default to 0 decimals. Unit tests deferred to B4 (no test runner installed yet — will land with B4-E2E).

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
| B1-OV | Overview 차트 섹션 (HeroChart, SectorHeat, SectorFlow, MacroMonitor, SessionVolume, Watchlist, IndicesStrip, TodaysEvents) | `pages/overview/*.tsx` (AI/Sentiment 제외) | frontend-ui-integrator | ✅ | 9/9 완료. HeroChart·SectorHeat·SectorFlow·MacroMonitor·SessionVolume·TodaysEvents (`0f02f7b`) + Workspaces (`c3e1364`) + IndicesStrip(`aa5b74a`, useNavigate→/detail, aria-label) + Watchlist(`9e8a161`). |
| B1-PF | Portfolio 표/할당 섹션 (KPIStrip, EquityCurve, Allocation, HoldingsTable) | `pages/portfolio/*.tsx` (AI 피드 제외) | frontend-ui-integrator | ✅ | 4 sections wired (B1-OV 커밋 `0f02f7b`에 staging-bleed로 묶여 들어감). KPI 1D/WTD/MTD/YTD toggle, EquityCurve range+benchmark, Allocation by-toggle, Holdings sortable + text filter. |
| B1-DT | Detail 차트 섹션 (MainChart, RSI, MACD, ValuationGrid, AnalystTargets, Peers) | `pages/detail/*.tsx` (AIGuide·Disclosures 제외) | frontend-ui-integrator | ✅ | 7/7 완료. Header(`11f2bee`)·ValuationGrid(`a1ccce9`)·AnalystTargets(`fb6eff1`)·Peers(`e2e2ee4`)·MainChart(`e5a6971`)·RSIPanel(`c1f0cca`)·MACDPanel(`cf38ce0`). 단순 prop-drilling, RSI(14)·MACD(12,26,9) client-side derive from getOHLC. |
| B1-GE | GeoRisk 사이드 섹션 (Hotspots, AffectedPortfolio, GlobalRiskIndex, LayerToggles, RiskLegend) | `pages/geo/*.tsx` (지도/AI 제외) | frontend-ui-integrator | ✅ | 5/5 완료. Hotspots(`38f3a7e`)·RiskLegend(`1a92b13`)·GlobalRiskIndex(`ac0cf0e`)·AffectedPortfolio(`aa5b74a`)·LayerToggles(`fb45fd0`). |

### 배치 B2 — 도메인 인프라 (B1과 병렬, 다른 디렉토리)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B2-MAP | WorldMap 재구현 (TopoJSON + d3-geo, 줌·팬, 레이어, 핀 클릭) | `app/src/lib/WorldMap/*` | frontend-ui-integrator | ✅ | TopoJSON(`world-atlas/countries-110m.json`) + `geoEqualEarth().fitSize([1000,500])`. heat 키 ISO 3166-1 alpha-3, M49→ISO-3 lookup 내장. pins lat/lng 우선, 레거시 x/y 폴백. 4-commit split (`0f09a7f` → `c87cf5a` → `746a2e8` → `5b7a7fe`). 줌·팬/핀-클릭은 후속. |
| B2-SRV | 로컬 Express 서버 부트스트랩 (포트 3001), Vite `/api` 프록시 | `server/*`, `vite.config.ts`, root `package.json` (workspaces) | backend-api-data-engineer (메인 마무리) | ✅ | npm workspaces + `concurrently`로 `npm run dev` 단일. tsx watch + Vite proxy `/api`→3001. `/api/health` 스모크 통과 (`60b7e49`). |
| B2-MD | Market data adapter — `yahoo-finance2` 래퍼 + REST + in-memory 캐시 (30~60s) | `server/providers/yahoo.ts`, `server/routes/{market,security,portfolio}.ts`, `app/src/data/*.ts` 본문 swap | backend-api-data-engineer | ✅ | yahoo-finance2 v3.14. 23 endpoints: 9 market + 7 security + 7 portfolio. Cache 30s quotes / 60s historical. Fallback mock on yahoo errors. CPI: dynamic import FRED + hardcoded fallback. Portfolio backing: `~/.intelistock/portfolio.json`. (commits `f832399`→`5e5020f`→`b6dd421`→`33c4a33`→`177828f`→`14db3d3`→`ec8ac01`) E2E 13/13. |
| B2-FRED | FRED 어댑터 (CPI 등 매크로) — 선택. API key 미설정 시 mock 유지 | `server/providers/fred.ts`, `server/routes/macro.ts` | backend-api-data-engineer | ✅ | Provider with `isConfigured`/`getCPI`(CPIAUCSL YoY)/`getFedFunds`(FEDFUNDS). Routes (`a41664a`+`601dcee`): GET /cpi, GET /fed-funds. 503 guard middleware로 키 없으면 fall-through. 1h TTL cache. (에이전트가 마무리 직전 permissions skill로 빠져 메인이 route 커밋) |
| B2-SEC | SEC EDGAR 어댑터 (공시 원문 메타데이터) | `server/providers/sec.ts`, `server/routes/security.ts` 확장 | backend-api-data-engineer | ✅ | Provider `getCompanyTickers()` (1회 캐시) + `getRecentFilings(cik,limit)`. Routes endpoint `GET /:symbol/filings` — staging-bleed로 B2-MD `33c4a33` commit에 함께 묶임 (메시지 명시). 한국 ticker(.KS/.KQ)는 `[]` 200. User-Agent 헤더. (`f0cc620`) |
| B2-AI | AI 백엔드 프록시 (Claude API 라우터, 스트리밍, 응답 캐시) | `server/routes/ai.ts` | backend-api-data-engineer + claude-api skill | ✅ | Model `claude-opus-4-7`. `cache_control:{type:'ephemeral'}` on system-prompt for all 4 endpoints. SSE GET /signals + /insights 파싱 후 이벤트 fan-out. POST /verdict + /hedge JSON. Frontend HEAD probe → 503 시 mock generator로 fallback. (`489b8dc`→`7fc9027`→`415c93c`→`ac5c914`) |
| B2-TW | Tweaks 확장 (timezone, locale, currency, 컬럼설정 영속화) | `app/src/lib/tweaks.tsx` | frontend-ui-integrator | ✅ | localStorage 영속화 (`intelistock.tweaks.v1`), timezone/locale/currency selects, reset 버튼, locale → `<html lang>` 반영. 기존 useTweaks consumers 호환. |
| B2-AI2 | 멀티프로바이더 AI (Anthropic + Gemini) + 대시보드 모델 스위처 | `server/providers/{gemini,registry}.ts`, `server/routes/ai.ts`, `app/src/data/{types,ai}.ts`, `app/src/lib/tweaks.tsx`, `.env.example` | main | ✅ | (`145cfec`) `@google/genai` 추가. registry.ts에 PROVIDERS 카탈로그 + `generate()` 단일 디스패치. 모든 AI 엔드포인트가 `?provider=&model=` 쿼리/바디 파라미터 수용. `GET /api/ai/models` 신규. Tweaks 패널에 "AI" 섹션 (Provider · Model 셀렉트) 추가, 카탈로그 mount-time fetch, 비설정 provider는 "(off)" + env var 안내. defaults: opus-4-7 / gemini-2.5-pro. |

### 배치 B3 — AI 의존 섹션 (B2-AI 완료 후)

| ID | Task | 파일 | Agent | Status | Blocks/by | Notes |
|---|---|---|---|---|---|---|
| B3-OV-AI | Overview AISignals + Sentiment | `pages/overview/AISignals.tsx`, `Sentiment.tsx` | frontend-ui-integrator + claude-api | ✅ | by B2-AI | AISignals → `useAsyncStream(streamSignals)` (`c6671cc`); Sentiment → `useAsync(getFearGreed)` (folded into B2-MD2 `94c8729` via staging-bleed). Skeletons dim while streams warm up; SSE→Gemini fallback verified via 503-on-HEAD probe inside `data/ai.ts`. |
| B3-PF-AI | Portfolio AIInsightsFeed | `pages/portfolio/AIInsightsFeed.tsx` | frontend-ui-integrator + claude-api | ✅ | by B2-AI | `e639e41` — `useAsyncStream(streamInsights('default'))` + ALL/OPP/RISK/MACRO/EARNINGS chip filter, header chip toggles WAIT↔N NEW. 3 dimmed skeleton cards while warming; empty-filter shows muted msg. |
| B3-GE-AI | Geo AIHedgeSuggestion + LiveAlerts | `pages/geo/AIHedgeSuggestion.tsx`, `LiveAlertCard.tsx` | frontend-ui-integrator + claude-api | ✅ | by B2-AI | LiveAlertCard → `useAsyncStream(streamAlerts)` (`1f141f3`), AIHedgeSuggestion → `useAsync(proposeHedge('semis-heavy…Taiwan-tension'))` (`26b03b8`). Card always shows latest alert; "N alerts in feed" tail when >1. Hedge description accent-colors `expectedDrawdownTrim` substring. |
| B3-DT-AI | Detail AIInvestmentGuide + Disclosure 요약 | `pages/detail/AIInvestmentGuide.tsx`, `DisclosuresFeed.tsx` | frontend-ui-integrator + claude-api | ✅ | by B2-AI | AIInvestmentGuide → `useAsync(getVerdict(symbol))` (`4f37303`); DisclosuresFeed → `useAsync(getFilings(symbol))` (`9fc7632`). Both accept optional `symbol?: string` prop with `'NVDA'` default — keeps pre-B4-RT `index.tsx` building until B4-RT plugs `useParams()` through. Empty filings show "No filings on record for {symbol}". |

### 배치 B4 — 횡단 관심사 (B1·B2 끝나면 병렬)

| ID | Task | 파일 | Agent | Status | Notes |
|---|---|---|---|---|---|
| B4-RT | Detail 라우트 다이나믹화 `/detail/:symbol` + ⌘K 검색 | `App.tsx`, `lib/SymbolSearch.tsx` | frontend-ui-integrator | ✅ | 7-step split: SymbolSearch skeleton+CSS (`3d674f0`) → ⌘K toggle in App.tsx (`1177d4c`) → debounced getSearch + Up/Down/Enter + click navigate (`d689614`) → `/detail/:symbol` route (`74d7552`) → `useParams<{symbol?:string}>() ?? 'NVDA'` in detail/index.tsx (`b972f74`) → IndicesStrip migrated to `navigate('/detail/'+ticker)` (`a9d08fd`). Modal: 14vh top-offset overlay w/ blur(8px), focus on open, Esc/click-outside close, ARIA listbox+activedescendant, Top-N=8, 200ms debounce, race-token cancellation. Build passes; existing E2E `/\\/detail/` regex still matches. |
| B4-RS | 반응형/모바일 (현재 1100px 이하 sidebar 숨김 → 본격 대응) | 각 페이지 + `styles.css` | frontend-ui-integrator | ⬜ | |
| B4-A11 | 접근성 (포커스 링, ARIA, 키보드 nav, 색대비) | 각 컴포넌트 | frontend-ui-integrator | ⬜ | |
| B4-E2E | Playwright E2E (4 페이지 스모크 + 인터랙션) | `app/tests/*.spec.ts` | document-skills:webapp-testing | 🟡 | **부분** (commits `6840b00`, `da152e5`): 13 tests passing in 1.9s — 6 smoke (shell·4 routes·/api/health proxy) + 7 interactions (IndicesStrip click, HeroChart 1M, Portfolio sort+filter, Detail 1Y, Tweaks accent+density). webServer reuses `npm run dev`. Bug found+fixed: Allocation skeleton key 중복. **남은 작업: visual regression(B2-MD 이후), unit tests(format.ts), keyboard a11y, mobile viewport** |
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

- ✅ **Pre-Phase 0** — Vite+React+TS 스캐폴드 (commit `1445063`)
- ✅ **§7 결정 잠금 (5/5)** (commit `f3773f3`)
- ✅ **Phase 0 완료 (3/3)** — 0-A `316f97f` · 0-B `01dc917` · 0-C `ac08ef6`
- ✅ **Phase 2 완료 (5/5: prep + MD + FRED + SEC + AI)** — 23 market+security+portfolio + 4 AI + 2 macro + 1 SEC filings endpoint. 프론트엔드 `data/*.ts` 본문 모두 fetch swap.
- ✅ **B2-AI2** — 멀티프로바이더 AI (Anthropic + Gemini) + 대시보드 Tweaks의 Provider/Model 셀렉트.
- ✅ **B2-MD2** — Yahoo 안정화: TTL 30/60s → 300/600s, LastGoodCache + tryCache helper, market/security 모든 yahoo-기반 엔드포인트 500 → mock 200 fallback.
- ✅ **B3 (4/4)** — AI 의존 UI 7섹션 모두 와이어링: AISignals/Sentiment, AIInsightsFeed (+ 카테고리 칩 필터), LiveAlertCard, AIHedgeSuggestion, AIInvestmentGuide, DisclosuresFeed.
- ✅ **B4-RT** — `/detail/:symbol` 다이나믹 라우트 + 글로벌 ⌘K 심볼 검색 모달 (debounced getSearch, Up/Down/Enter, ARIA listbox).
- 🟡 **B4-E2E** — **13/13 통과 in 3.9s** (Yahoo offline 시뮬레이션 OK, AI UI mock fallback OK, ⌘K 통합 OK). 잔여: 시각 회귀, A11y, 모바일 viewport, unit tests.
- 실행: `npm run dev` (root) → Vite :5180 + Express :3001. ⌘K 검색·`/detail/<TICKER>` 직접 URL·Tweaks Provider 셀렉트 모두 동작.

- ✅ **Phase 1 완료 (7/7)** — 두 라운드에 걸쳐 모두 완료:
  - B1-OV ✅ 9/9 · B1-PF ✅ 4/4 · B1-DT ✅ 7/7 · B1-GE ✅ 5/5
  - B2-MAP ✅ TopoJSON · B2-SRV ✅ Express + Vite 프록시 · B2-TW ✅ 영속화
  - Bonus: `pages/geo/WorldMap.tsx` → `getRiskMap` 와이어링 (메인 마무리, `adb6566`)
  - 빌드: 215 modules, 373.17 KB JS / 124.59 KB gz, `tsc -b && vite build` 통과
  - 라운드 1 (4/28 23:40 ET): rate-limit으로 5에이전트 중도 종료 → B1-DT/B2-MAP 롤백
  - 라운드 2 (4/29): 4 재실행 모두 성공
- 👉 **다음 (Phase 2)**: B2-SRV 풀림 → **B2-MD / B2-FRED / B2-SEC / B2-AI** 4개 동시 실행 가능. 모두 `server/routes/*` + `app/src/data/*.ts` 본문 fetch swap.
- 또한: **B3** (AISignals/Sentiment/AIInsightsFeed/AIHedge/LiveAlerts/AIInvestmentGuide/Disclosures) 4건은 B2-AI 완료 후 시작.

### Lessons from Phase 1
- **글로벌 rate limit이 에이전트를 마지막 push 전에 끊을 수 있음** — round 2부터 섹션별 즉시 commit·push로 진행분 손실 최소화. 효과 있었음.
- **동일 working tree 공유 시 staging-bleed 빈번** — `git add <specific files>` 만으로도 100% 막지 못함. 한 에이전트의 staged 파일이 다른 에이전트의 commit에 묻혀 들어가는 사례가 두 라운드 모두 발생. 다행히 모두 owned 파일끼리의 cross-merge라 결과는 main에 정확히 반영됨. 다음 페이즈는 **`git worktree add`로 에이전트별 독립 워크트리** 권장 (B2-MAP 에이전트 제안).
- **deps + 타입 + 컴포넌트 변경을 한 commit에 묶으면 위험** — round 2 B2-MAP는 4단계 분할 commit으로 안전. Phase 2도 같은 패턴 권장.
- 부분 완료된 미커밋 변경은 빌드 검증 후 폐기 vs 보존 결정 — round 1에서 깨진 B1-DT/B2-MAP는 폐기가 정답이었음.

### 데이터 수집 전략 요약

**Phase 0:** mock fetcher만 (실데이터 X). 페이지는 `data/*.ts` 함수만 호출.

**B2-MD (B2 페이즈):** 로컬 Express 서버(`server/`, 포트 3001)가 외부 데이터 소스를 호출하고 통일 JSON으로 프론트에 노출. Vite dev에서 `/api` 프록시.

| 도메인 | 소스 | 키 | 비고 |
|---|---|---|---|
| 시세·OHLC·펀더멘털·컨센·어닝·검색 | yahoo-finance2 | 불필요 | 비공식, 어댑터로 격리 |
| 섹터 | XLK·XLE·XLF·XLV·XLY·XLI·XLP·XLB·XLU·XLRE·XLC ETF | 불필요 | yahoo로 시세 fetch 후 derive |
| 인덱스 (KOSPI/KOSDAQ 포함) | yahoo (`^GSPC`, `^IXIC`, `^DJI`, `^KS11`, `^KQ11`, `^VIX`, `^TNX`, ...) | 불필요 | |
| FX·원자재 | yahoo (`KRW=X`, `CL=F`) | 불필요 | |
| CPI 등 매크로 | FRED API | 무료 키 | 키 없으면 mock 유지 |
| 공시 (SEC filings) | SEC EDGAR | 불필요 (User-Agent 필수) | ticker→CIK 매핑 1회 캐시 |
| Fear & Greed | mock | — | CNN 공식 API 없음 |
| 지정학 / 알림 | mock | — | NewsAPI는 B5에서 검토 |
| AI (시그널·베르딕트·헷지) | Claude API (`claude-opus-4-7`) via 로컬 프록시 | ANTHROPIC_API_KEY | prompt caching 필수 |

---

## 7. Locked decisions

| # | Decision | Locked value | Date |
|---|---|---|---|
| 1 | Workspaces 좌측 nav | **유지 (그대로 사용)** | 2026-04-28 |
| 2 | Market data 공급자 | **`yahoo-finance2`** (Node 패키지, 키·시그업 불필요). 미커버는 FRED(CPI)·SEC EDGAR(공시)로 보조. F&G·지정학은 mock 유지 | 2026-04-28 |
| 3 | 백엔드 호스팅 | **로컬 MacBook** — `server/` (Node + Express, 포트 3001). Vite `/api` 프록시로 연결 | 2026-04-28 |
| 4 | Detail 심볼 형식 | **Yahoo 표기 = 사실상의 web 공용** — US `NVDA`, KOSPI `005930.KS`, KOSDAQ `247540.KQ` | 2026-04-28 |
| 5 | 시각 회귀 | **자체 Playwright snapshot** (`toHaveScreenshot`) | 2026-04-28 |
| 6 (open) | 인증 도입 시점 | 미정 — B5는 선택. 멀티 디바이스 동기화 필요해질 때 재논의 | — |
