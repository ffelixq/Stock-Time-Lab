# Research methodology

## Sampling and returns

Each date receives equal weight. The stock and every selected peer/benchmark must have all expected valid bars on that date. Duplicate ticker/date/time keys fail the run rather than selecting a price silently. Invalid OHLC values are discarded and counted. The current local trading date is always excluded, even after the close, to avoid partial provider data.

A session return is `last session close / first session open - 1`. The arithmetic mean is taken across daily returns. Hourly means are not added to obtain session returns. Per-hour session comparisons in JSON use mean log return divided by session duration. These are not annualized investment returns.

The reopening/boundary gap is `second-session open / first-session close - 1`. Full continuous-day return spans first open to last close, including the observed gap. A between-session return spans the previous observed complete day close to the next observed day open. It is not an official close-to-open overnight return: closing auctions, entirely missing dates and provider adjustments can change its meaning. Incomplete intervening days reset the prior close; known split dates suppress the gap.

Prices are not automatically dividend-adjusted. Corporate-action checks only run when the provider/CSV supplies that coverage. If downloading current history, provider revisions can differ from the frozen sample. The programme reports this rather than promising identical prices on later downloads. The frozen sample does not include a complete corporate-action calendar, so those checks are unavailable there.

## Statistical estimates

For daily returns `x`, `e = x - mean(x)` and lag count `L=5`, the variance of the sample mean is:

`[sum(e_t²) + 2 × sum_l (1-l/(L+1)) × sum_t(e_t × e_(t-l))] / n²`.

The lower bound on variance is zero for numerical safety. Standard deviation uses the ordinary `n-1` sample denominator. Confidence limits use `mean ± 1.95996398454 × SE`. Two-sided p-values use a standard-normal approximation. Confidence limits and p-values are suppressed for fewer than 20 observations and for zero estimated variance. Five lags are observation lags after filtering, not necessarily five consecutive exchange dates. HAC p-values are estimates with finite-sample limitations.

Holm step-down correction is applied separately to:

1. All selected instrument/hour means.
2. All selected instrument first/second-session means.
3. Primary-minus-comparator session means.
4. All selected instrument/session/window event differences.

These families are fixed by the run configuration. Testing more tickers, dates or filters in later runs introduces further selection not covered by a single run's correction. Year/month/weekday, rolling, conditional and sensitivity tables are exploratory; their displayed unadjusted intervals are not a search-wide significance claim.

For event differences, mean(after) minus mean(before) uses `sqrt(SE_before² + SE_after²)` with the same normal approximation. This assumes independent period means and is only an approximate descriptive comparison. It does not model covariance across the event boundary, external controls or causation. Matched windows use the last `min(n_pre,n_post)` pre-event sessions and the first that many post-event sessions.

## Robustness and stability

Trimmed means remove 5% at each tail; trimmed confidence intervals are not presented. The largest-move check removes up to 10 observations, capped at 10% of the sample, separately for each session. Corporate-action sensitivity removes supplied ex-dividend/split dates. Explicit exclusions are applied before matching peers and recorded in configuration.

Conditional results compare second-session returns after positive, negative, flat and top-quartile absolute first-session moves. The quartile is calculated using the whole descriptive sample. It must not be presented as an out-of-sample trading threshold.

The chronological split allocates the last selected percentage of dates to a later stability period. Both periods are displayed. Viewing them invalidates any claim that the later data are still a sealed holdout. Freeze hypotheses and collect unseen future data for genuine confirmation. Overlapping rolling means are not independent observations.

## Costs

The cost model assumes a fixed cash amount and a fractional number of shares, with no leverage, lot rounding, reinvestment or FX conversion. The first session's observed return determines actual sale notional. Each side pays `max(notional × brokerage%, minimum brokerage) + notional × exchange% + fixed fee`, multiplied by the entered fee-tax rate. Spread/slippage is an extra number of basis points on each side's notional. Net profit is gross profit minus both sides' fees and execution allowance.

The source study's quick illustration charged percentage fees on the same initial notional on both sides. This implementation improves that approximation by using each day's actual exit notional. Thus DBS's gross average reproduces exactly while its sample mean net result differs by less than one cent.

Price bars do not guarantee fills at the displayed prices. Historical bid/ask spreads, market impact, short-borrow costs, board lots and broker-specific special charges are not reconstructed. There is no strategy optimization or simulated equity-curve claim.

## Excel

`Raw` stores typed OHLC inputs. `Daily` links to those prices with formulas for session and hourly returns. `Overview` links its primary means and pattern rate to `Daily`. The `Fees` sheet exposes numeric inputs and live per-trade formulas. Formula cells include cached results and request recalculation on opening in Excel.

Statistical tests, flags, confidence intervals and subgroup membership are exported snapshots. Editing source prices inside Excel does not rerun the JavaScript statistical pipeline; rerun the application/script for a fully consistent new study. The Method sheet records this limit, the settings and the data source.

## Sources

- SGX market phases: https://www.sgx.com/securities/trading
- SGX trading-hours rulebook: https://rulebook.sgx.com/rulebook/regulatory-notice-821-trading-hours-market-phases-application-market-phases-and-principles
- NYSE hours: https://www.nyse.com/markets/hours-calendars
- HAC reference implementation: https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html
- Holm correction: https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html
- Time-ordered evaluation: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
- Yahoo integration reference: https://github.com/ranaroussi/yfinance/blob/main/yfinance/scrapers/history.py

References explain market structure and methodology; they are not an endorsement of the source data, application or any trading strategy.
