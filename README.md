# Stock Time Lab

A reusable intraday stock research engine, a command-line script and an interactive website. The website and script import the same calculation code. No LLM calls or API key are required.

Test website: [Stock Time Lab](https://stock-time-lab.felixxxquek.chatgpt.site) (owner-private through ChatGPT Sites).

The repository stores the source. Sites is the test deployment. There is **no GitHub Pages, Vercel or other production auto-deployment workflow**.

## Quick start: the script

Install Node.js 22.13 or newer and clone this repository. The research CLI itself uses only built-in Node modules; it requires **no npm installation**.

```bash
git clone https://github.com/ffelixq/Stock-Time-Lab.git
cd Stock-Time-Lab
node scripts/analyse.mjs --sample --out outputs/dbs
```

This reproduces the saved DBS / OCBC / UOB study from 26 September 2024 to 24 September 2026. The sample is historical data, not a live feed. Regression tests reproduce all three session means, 492 matched days and DBS's 139 pattern days.

For new prices, edit the dates, tickers, market and fees in a copy of `examples/sgx.json` or `examples/us.json`:

```bash
node scripts/analyse.mjs --config examples/us.json --out outputs/us-study
```

The examples contain fixed dates. Update them for the period you want; the data provider's historical limits move over time. For the newest data, the website has a **Use latest year** control.

For a CSV exported by your broker or data provider:

```bash
node scripts/analyse.mjs --config examples/sgx.json --csv prices.csv --out outputs/import
```

A Python convenience launcher is also available. It invokes exactly the same JavaScript engine and requires Node:

```bash
python scripts/analyse.py --sample --out outputs/dbs
```

Each run writes:

| File | Purpose |
| --- | --- |
| `study.xlsx` | Excel workbook with source prices, session formulas, statistics and editable fee assumptions |
| `summary.md` | Short findings and methodology for discussion |
| `results.json` | Compact statistics, uncertainty, configuration and provenance |
| `source-prices.csv` | Source data in a portable format |
| `dataset.json` | Source bars plus provider metadata and corporate-action flags, when supplied |
| `config.json` | Exact settings used in the run |

Give ChatGPT `summary.md` and `results.json` for interpretation. Keep the source data for any follow-up investigation. Local output folders are ignored by Git.

## Website development

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Use the local URL printed by the development server. The application uses the Vinext/React starter and produces a Cloudflare Worker-compatible build:

```bash
corepack pnpm build
```

The repository pins its pnpm version in `package.json`; Corepack selects it. If your Node installation does not include Corepack, install pnpm separately and run `pnpm install --frozen-lockfile`, then `pnpm dev`. Do not commit `.env`, dependency directories or generated reports.

## Website flow

1. The saved DBS study loads immediately and is clearly labelled **Saved study**.
2. Select **SGX** or **US**, a primary ticker, up to four peers and an optional same-market benchmark.
3. Choose dates, then **Download & run study**. Provider failures display an error; they never silently substitute sample data.
4. Use the five views for overview, hourly/period results, evidence checks, costs and report/data exports.
5. Under **Events & exclusions**, optionally set a local event date, excluded dates and the chronological split. **Recalculate loaded data** reruns locally using existing bars.
6. Under **Trading costs**, edit the assumptions and click **Apply costs**. Downloads use the applied settings.

CSV imports are processed in the browser and are not uploaded. New live price requests go through the site's `/api/prices` endpoint to a fixed Yahoo Finance host. Tickers are validated; arbitrary URLs are not accepted. Data are held in memory for the current tab. Refreshing returns to the saved study; download a report to retain a run.

## What is implemented

- Hourly OHLC validation, duplicate rejection, missing-bar and off-session counts.
- Matching complete sessions across the selected instruments.
- First/second-session returns, full-day continuous-session returns, reopening gaps and previous-observed-session gaps.
- Mean, median, SD, percentiles, up/down/flat shares, pattern and conditional probabilities.
- Years, months, weekdays, recent 20/60/120 sessions and rolling 20/60-session means.
- 95% Newey–West intervals (five observation lags), large-sample normal p-values and Holm corrections.
- Paired excess returns and correlations versus selected peers/benchmark.
- Sensitivity to trimming, largest absolute moves, explicit date exclusions and corporate actions when supplied.
- Before/after event comparisons, including matched-length windows.
- Chronological earlier/later stability checks.
- First-session long-only cost scenarios using actual entry/exit notionals, minimum brokerage, fixed/percentage fees, fee tax and per-side spread/slippage.
- Formula-backed Excel exports, compact JSON/Markdown and source-data exports.

## Definitions and limits

Read [docs/METHODOLOGY.md](docs/METHODOLOGY.md) before interpreting results.

- **SGX:** first session 09:00–12:00; second 13:00–17:00, Singapore time. Noon and closing-auction bars are excluded.
- **US equities:** first session 09:30–12:30; second 12:30–16:00, New York time. The last 15:30 bar spans 30 minutes. IANA timezone conversion handles daylight saving. This is a session split, not a US lunch break.
- Inputs must be one-hour **start-labelled** OHLC bars aligned with those boundaries. Five-minute, daily and incompatible provider buckets are not silently resampled.
- Complete regular sessions are inferred from required bars. An external historical exchange calendar is not bundled. Missing entire dates cannot be classified as holidays versus missing data; incomplete/short sessions and the current local day are excluded.
- All comparisons use matching dates. Adding peers/benchmarks can reduce the sample.
- The Yahoo chart endpoint is an unofficial convenience integration with changing history limits, availability and rate limits. Around two years of hourly data may be accessible, but no minimum history or service level is guaranteed. Use CSV from a source you are authorised to use when necessary.
- This version supports SGX and US equities. Crypto, futures, arbitrary exchanges, news/event discovery and factor regressions are not implemented. Those can be separate modules after reviewing the base results.
- Cross-market comparisons and currency conversion are not supported.
- No trading signals, orders or brokerage account access are provided.

## Checks

```bash
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The tests cover the original-study regression, endpoint returns, matched dates, missing/duplicate prices, noon exclusion, US daylight saving, fees, CSV parsing, corporate-action exclusions and provider errors. CI runs these calculation checks; it does not deploy a website. Type checking and the production build are also checked during site preparation.

## Project structure

```text
app/page.tsx                  Website controls and result views
app/api/prices/route.ts        Validated price-download endpoint
lib/research/engine.mjs        Shared calculation pipeline
lib/research/stats.mjs         HAC statistics and multiple testing
lib/research/data.mjs          Yahoo adapter and CSV import/export
lib/research/workbook.mjs      Portable OOXML workbook export
scripts/analyse.mjs            Dependency-free CLI
scripts/analyse.py             Python launcher for the same CLI
examples/                     Editable study configurations
tests/                        Calculation and input validation tests
public/data/sg-banks.json      Original study's historical source bars
```

## Keeping Sites and GitHub together

During testing, update this source repository and publish the matching code to the existing Sites project. `.openai/hosting.json` identifies that same project and contains no credentials. Do not create a new Site for each revision. Sites also maintains its own deployment-source Git repository. Record both the GitHub commit and Sites version when publishing. No automatic bidirectional synchronization is configured: code changes must be deliberately saved to both remotes during each update.

Review the test website first. A separate production deployment can be configured after testing.
