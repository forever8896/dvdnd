# Memecoin Launchpad (pump.fun-style) Mechanics and Outcomes: Simulation Parameters vs. Tokenized Dividend PE

Research date: 2026-10-25. The memecoin market changes quickly, so every figure below carries its date. Most volume and market-share numbers come from secondary crypto press that cites Dune or DefiLlama. I did not open the Dune dashboards or the original Solidus Labs PDF myself.

## Q1. Mechanics: pump.fun bonding curve, graduation, fees, and other launchpads

### Takeaway
pump.fun runs a constant-product virtual-reserve curve: 30 virtual SOL against 1.073B virtual tokens, with k fixed and a total supply of 1B. 793.1M tokens are sold on the curve. A token graduates once the curve has collected about 85 real SOL (115 SOL total reserve, roughly $69k market cap at Sept 2025 prices). Graduated tokens move to PumpSwap. The total swap fee is about 1.25% (0.95% platform, 0.3% creator). Rival launchpads use the same template with different thresholds and fee splits.

### Cited Findings
**pump.fun curve (as of Sept–Oct 2025 data)**
- Total supply 10^9. 0.7931×10^9 tokens sit on the virtual curve and 0.2069×10^9 are reserved for the PumpSwap pool. Initial virtual SOL = 30. Initial virtual token reserve = 1.073×10^9 (0.7931B real + 0.2799B synthetic). Constant-product invariant k = x0·y0, fixed during the curve phase, with no liquidity add or remove. Graduation threshold = 115 SOL total reserve (30 virtual + 85 real), about $69k market cap. — [Marino et al., arXiv 2602.14860 (data Sep 2025)](https://arxiv.org/html/2602.14860v1)
- Fees in the same paper: total swap fee 1.25%, split 0.95% platform and 0.3% creator during the curve phase. The PumpSwap creator fee is dynamic, falling from 0.95% to 0.05% as the token grows. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- Median graduating token needs about 457 curve trades and about 4.4 minutes from creation. Graduated tokens implied about 3.7×10^5 SOL (about $74M) of net volume over the month. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- Implied breakeven: buy-and-hold at curve SOL level vSol is profitable only if P(graduate | vSol) > vSol²/115². The authors find the baseline graduation probability sits below breakeven across most of the curve. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- Threshold drift: one source cites an $80k–100k market cap (about 80 SOL in the curve). The cap is fixed in SOL, so its USD value moves with the SOL price. — [Bitget/Cryptopolitan summary](https://www.cryptopolitan.com/pump-fun-graduating-tokens-break-to-1-15-of-new-launches/); [CoinPaprika (Oct 2026)](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- Creator fees over time: a flat 0.05% creator fee was introduced in May 2025. "Project Ascend" (about 2 Sep 2025) replaced it with Dynamic Fees V1 on PumpSwap: 0.95% for market cap under about $300k, tapering to 0.05% above $20M. Protocol and LP fees were unchanged. — [Blockworks](https://blockworks.com/news/pumpdotfun-fee-model); [CryptoSlate](https://cryptoslate.com/pumpfun-launches-initiative-to-become-solanas-hub-for-successful-projects-boosts-creator-earnings-10x/)
- About $2M went to creators in the first 24h after the change, against $198k on the Monday before (Dune). — [Decrypt](https://decrypt.co/337872/pump-funs-new-fee-model-hands-out-2m-to-creators-in-first-24-hours)
- Migration destination: Raydium historically, PumpSwap since 2025. — [CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/)

**Other launchpads (blog-level sources; check against platform docs)**
- LetsBonk.fun (Solana): 1% trade fee. Graduation threshold cited as 411 SOL (this looks inconsistent with other reports and is unverified). — [BitBank blog 2026](https://bitbank.nz/blog/memecoin-launchpads-compared)
- Believe (Solana): $100k graduation market cap, 50/50 creator/platform fee split. A research file describes it as effectively offline by 2026. — [BitBank](https://bitbank.nz/blog/memecoin-launchpads-compared); [paired.exchange research doc](https://github.com/nirholas/paired.exchange/blob/main/docs/research/launchpads.md)
- Four.meme (BNB Chain): 0.5% trade fee, 24 BNB graduation, 0.005 BNB creation fee. It earned 45% of its lifetime revenue in October 2025 and now runs at about 1% of that peak. — [BitBank](https://bitbank.nz/blog/memecoin-launchpads-compared); [paired.exchange](https://github.com/nirholas/paired.exchange/blob/main/docs/research/launchpads.md)
- Clanker (Base/EVM): no bonding curve; the token mints straight into a Uniswap pool. Fee decays from 80% to 5% (an anti-sniper decaying fee). About 60% of revenue is reported to go to buybacks. — [paired.exchange](https://github.com/nirholas/paired.exchange/blob/main/docs/research/launchpads.md); [BitBank](https://bitbank.nz/blog/memecoin-launchpads-compared); [TechFlow](https://www.techflowpost.com/en-US/article/33875)
- Zora coins (Base): 1% trading fee, half to creators. On 30 Jul 2025 Zora accounted for 44.6% of newly issued tokens across networks. — [The Market Periodical](https://themarketperiodical.com/2025/03/25/reviewing-the-top-five-token-launchpads-driving-on-chain-wealth-creation/); [TechFlow](https://www.techflowpost.com/en-US/article/33875)
- Virtuals Protocol (Base): 100 VIRTUAL creation fee. Graduation at 42,000 VIRTUAL in the curve (cited as about $610.5k market cap), then a Uniswap V2 pool with liquidity reportedly locked 10 years. 1% trading tax. Sources disagree on the split: Forkast says 70% creator / 30% treasury; MEXC says 100% treasury before graduation and 70/30 creator/ACP incentives after. — [Forkast](https://forkast.news/virtuals-ecosystem-tokenized-agent-revenue-market-dynamics/); [MEXC tokenomics](https://www.mexc.com/sl-SI/price/VIRTUAL/tokenomics)
- Thresholds as of Oct 2026: Moonshot about $30k to Raydium; Raydium LaunchLab about $50k to Raydium CLMM; Meteora DBC configurable; Heaven and Boop vary by launch. — [CoinPaprika, citing managernest table](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- Market share swings: LetsBonk went from about 13% to over 78% of Solana launches in July 2025 while pump.fun fell from above 80% to 12.9%. pump.fun took share back after Project Ascend (Sept 2025). — [CoinGecko](https://www.coingecko.com/learn/letsbonk-fun-solana-memecoin-launchpad-guide); [Blockworks](https://blockworks.com/news/pumpdotfun-fee-model)

### Inferences
- Price on the curve: P(x) = (30 + x)² / (30 × 1.073e9) SOL per token, where x is real SOL deposited. From x = 0 to x = 85 the price rises (115/30)² ≈ 14.7×. A first buyer who holds through graduation makes about 14.7× gross. Someone who buys at x = 60 makes only about 1.6×. This convexity is what pays snipers.
- Graduation gives a token a market cap of about $69k–100k. That is roughly 4–5 orders of magnitude below what an investor would need for an institutional-scale PE comparison. Each launch is very small.
- Model the fee drag per round trip at about 2.5% on the curve (1.25% × 2), plus Solana priority/Jito tips.

### Gaps
- I did not verify pump.fun's official docs for the exact 2026 fee schedule. The fee was 1% at launch in 2024 and the arXiv paper reports 1.25% total in Sept 2025.
- I found no authoritative documentation for Meteora DBC default parameters, Heaven, or Zora's 2025 "content coin" curve (Zora moved to Uniswap v4 auto-pools; details unverified).
- LetsBonk's 411 SOL threshold comes from a single blog and conflicts with its pump.fun-like design. Treat it as unverified.

## Q2. Outcomes: graduation rate, launch rate, trader P&L, lifespan, rugs, snipers, post-graduation returns

### Takeaway
Fewer than 2% of launches graduate. Published estimates range from about 0.6% to 1.9%, depending on window and method. Most tokens stop trading within a day. About 92% show at least one statistical "dump", and Solidus Labs labels 98.6% as pump-and-dump or rug. Among high-activity wallets, roughly 50–60% lose money, and profits are concentrated in a few thousand wallets. Even graduated tokens typically drop about 50% within 10 minutes of graduating.

### Cited Findings
**Launch volume**
- Sept 2025: 655,770 tokens created by 243,123 creators in one month (about 21.9k per day), with 2.6M distinct trader addresses and 2–5M trades per day. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- 2024–2026: 5,000–15,000 new tokens per day (paper intro, attributed to the pump.fun team). — [arXiv 2607.02795 intro](https://arxiv.org/pdf/2607.02795)
- Dune via press: about 71,735 daily Solana launches on 23 Jan 2025, down to about 25,000 by 26 Feb 2025. Peaks of about 42k per day reported. — [Solana Compass](https://solanacompass.com/news/pumpfun-launched-42000-tokens-in-one-day-fewer-than-2-will-ever-reach-a-dex); [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/pumpfun-sees-80percent-decline-in-token-launches-as-meme-coin-market-loses-momentum)
- Aug 2026: 1,032,440 launches with 18,202 graduations in a month (about 33k per day). — [madeonsol via CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- Cumulative pump.fun tokens: over 1.8M by mid-2024 and over 4.2M by Dec 2024. Solidus counted over 7M from Jan 2024 to Mar 2025. — [The Block](https://www.theblock.co/post/329228/pump-fun-reaches-monthly-revenue-peak-with-93-million-in-november-rakes-in-cumulative-revenue-of-240-million); [BeInCrypto on Solidus](https://beincrypto.com/pump-fun-tokens-scams-solidus-labs-report/)

**Graduation rate**
- 0.63% (4,338 of 655,770, Sep 2025). Among tokens with at least 30 swaps the rate is 2.55%. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- About 0.7–0.8% in July–Aug 2025; 0.92% in summer 2025; weekly 1.15% in late 2025 (Dune). — [MEXC news](https://www.mexc.com/news/586607); [Cryptopolitan](https://www.cryptopolitan.com/pump-fun-graduating-tokens-break-to-1-15-of-new-launches/)
- 0.88% on a single day in late Feb 2025; historical about 1.4% (Dune). — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/pumpfun-sees-80percent-decline-in-token-launches-as-meme-coin-market-loses-momentum)
- 1.76% within the same window in Aug 2026; 1.89% lifetime as of 28 May 2026 (1.35M launches in that dataset). Author's working range for the second half of 2026: about 1.5–3%. — [CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- 1 in 58 (about 1.7%) in a Bitquery study, Nov 2025–Oct 2026. — [search summary citing Bitquery, via CoinCentral/Brave New Coin coverage](https://bravenewcoin.com/insights/what-auditing-832941-pump-fun-launches-taught-me-about-memecoin-success)
- 1.02% in Szwajcok et al., "Meme Coin Factories" (arXiv 2609.10246). — [Brave New Coin](https://bravenewcoin.com/insights/what-auditing-832941-pump-fun-launches-taught-me-about-memecoin-success)
- Do not use the 0.198% figure. It is a "fast-lane" artifact from a withdrawn preprint (arXiv 2607.02823). — [Brave New Coin, 14 Oct 2026](https://bravenewcoin.com/insights/what-auditing-832941-pump-fun-launches-taught-me-about-memecoin-success); [CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- Graduation is hard to predict out of sample: a model scored AUROC 0.86 in training and 0.46 on the following 14 days. — [Brave New Coin](https://bravenewcoin.com/insights/what-auditing-832941-pump-fun-launches-taught-me-about-memecoin-success)

**Rug / pump-and-dump prevalence**
- Solidus Labs 2025 Rug Pull Report (May 2025, covering Jan 2024–Mar 2025): 98.6% of pump.fun tokens are rugs or pump-and-dumps (Solidus's own post says 98.7%). Of over 7M launched, only about 97k kept more than $1,000 of liquidity. On Raydium, 93% of pools (361k–388k depending on source) showed rug traits; median loss about $2,832; largest about $1.9M. — [BeInCrypto](https://beincrypto.com/pump-fun-tokens-scams-solidus-labs-report/); [The Defiant](https://thedefiant.io/news/defi/alarming-99-of-memecoin-launches-on-pumpfun-are-pump-and-dumps-or-rug-pulls-report); [Forklog](https://forklog.com/en/report-98-of-pump-funs-memecoins-deemed-scams/)
- 92.22% of tokens with at least 30 swaps (169,938 of 184,282) had at least one dump (a log-return below −4 robust sigma), Sep 2025. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- "Nearly 95% effectively rugged within a day" is attributed to researcher Ogle. It is an unverified estimate. — [The Block](https://www.theblock.co/amp/post/330697/chainalysis-expands-solana-coverage-to-include-pump-fun-memecoins)

**Lifespan / post-graduation price path**
- 79% of pump.fun tokens had no trades after launch day. A third of September 2026 graduates saw 3 or fewer trades after graduating (Bitquery). — [search result summary; see Brave New Coin / CoinCentral](https://coincentral.com/memecoin-statistics-2026-market-cap-returns-lifespan-data-and-why-97-fail)
- 2,193 graduations, 10–12 Oct 2026: 38.1% touched −80% within 10 minutes of graduating. The median token's 10-minute low was about 50% below its price 10 seconds after graduation. This is a developer blog, not peer-reviewed. — [DEV Community / launchtape](https://dev.to/launchtape/what-2193-pumpfun-graduations-did-in-their-first-10-minutes-and-what-it-means-for-your-bot-4f70)
- Across all memecoins, not just pump.fun: the median coin peaked 17.2 days after first trade and was down about 95% from that peak about 370 days later. — [CoinCentral 2026](https://coincentral.com/memecoin-statistics-2026-market-cap-returns-lifespan-data-and-why-97-fail)

**Trader P&L distribution**
- Dune, six months to about July 2025: 4.257M addresses that traded more than 10 pump.fun tokens. About 60% lost money; 2.4M (56.6%) lost between $0 and $1,000; about 1,700 lost over $100k; about 5,000 gained over $100k; 311 gained over $1M. — [BeInCrypto](https://beincrypto.com/pump-fun-trading-data-majority-lose-money/); [BeInCrypto 2](https://beincrypto.com/pump-fun-meme-coins-trader-losses/)
- March 2026 Dune dashboard by @oladee, about 1.4M wallets: 49–50.6% lost money; about 4% gained more than $500; 2 wallets made over $1M that month. The widely shared "96% lose" figure actually means "lost money or made less than $500". — [MEXC news](https://www.mexc.com/news/992439)
- "97% of traders lose money" (Jan 2026) is an analyst claim that I could not verify. — [CoinAlertNews](https://coinalertnews.com/news/2026/01/08/pump-fun-trader-losses-token-decline)
- Top-wallet expected profit at $200/SOL, Sep 2025: about $1.87M for the best wallet over the full period and about $604k for the best wallet in the first two weeks. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)

**Snipers / insiders / bundles**
- arXiv 2607.02795 (data 11–25 Jun 2026; 166,098 launches) reported 1,012 persistent sniper cohorts. In Oct 2026 the authors withdrew all numerical results (about 43% of "buy" rows were actually sells), so none of its numbers should be cited. — [arXiv 2607.02795 correction notice](https://arxiv.org/pdf/2607.02795)
- Case evidence only: Bubblemaps found single tokens where about 90% of supply went to a wallet cluster at launch. — [Bubblemaps coverage, Benzinga](https://www.benzinga.com/content/43763660/bubblemaps-analysts-confident-libra-meme-coin-tied-to-melania-creators)
- Sep 2025: bot activity (direct contract calls) is used as a predictor, and only tokens with bot share ≥0.3 approach buy-and-hold breakeven near graduation. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)

### Inferences
- The P&L figures are biased toward survivors because they count only wallets with more than 10 tokens traded. Including one-time retail would probably raise the loss share. Fees and the 1.25% swap tax make the platform as a whole negative-sum for traders.
- Profits are concentrated: about 5k of 4.26M active wallets (0.12%) made over $100k in six months. That is the right tail for a power-law winnings distribution.

### Gaps
- I found no reliable aggregate dataset for sniper or bundle share of supply. The main academic estimate is withdrawn. Solidus and Bubblemaps give case studies, not distributions.
- I found no peer-reviewed median 24h/7d/30d post-graduation return. Only the 10-minute blog figure above is available.
- I did not find the "0.4% of wallets made more than $10k" statistic from the brief in a primary source. It is commonly attributed to a 2024 Dune dashboard (adam_tehc) but is unverified here.
- I found no Chainalysis study specific to pump.fun sniping. Chainalysis only announced compliance coverage of these tokens.

## Q3. Volume, revenue and activity over time

### Takeaway
pump.fun passed $1B in cumulative revenue in early 2026 ($321M in 2024, $664M in 2025). It went through an 80%+ activity slump in early 2025 and a quiet mid-2026, then recovered to about $2M per day in revenue by Aug–Oct 2026.

### Cited Findings
- Cumulative revenue: about $50M (mid-2024), about $100M within 8 months of launch, $240M by end of Nov 2024, about $1.08B by about Mar 2026, then about $1.2B–1.23B later in 2026. — [The Block $50M](https://theblock.co/post/302734/pump-funs-cumulative-revenue-crosses-50-million); [The Block $100M](https://www.theblock.co/amp/post/311726/pump-fun-nears-100-million-cumulative-revenue-within-eight-months-of-launch); [The Block $1B](https://www.theblock.co/post/393358/pump-fun-becomes-solanas-first-1b-revenue-platform); [KuCoin](https://kucoin.com/news/flash/pump-fun-surpasses-hyperliquid-in-30-day-revenue-as-pump-rises-12)
- Monthly revenue peaked at over $93M in Nov 2024 (DefiLlama). — [The Block](https://www.theblock.co/post/329228/pump-fun-reaches-monthly-revenue-peak-with-93-million-in-november-rakes-in-cumulative-revenue-of-240-million)
- DefiLlama quarterly gross protocol revenue, 2026: Q1 $108.3M, Q2 $79.2M, Q3 $122.8M, Q4 to date about $47.7M. Trailing 30 days (late Oct 2026): fees about $63.9M, revenue about $46.4M. DefiLlama changed its methodology in Oct 2025 to include PumpSwap and Terminal, so comparisons across that date are not like-for-like. — [DefiLlama](https://defillama.com/protocol/pump.fun)
- Daily revenue was $2.4M in Aug 2026, the highest since Sep 2025. On 24 Oct 2026 pump.fun's 24h revenue was $1.98M against Hyperliquid's $1.96M. — [CryptoBriefing](https://cryptobriefing.com/pumpfun-daily-revenue-highest-since-september/); [Cryptonomist](https://en.cryptonomist.ch/2026/10/24/pumpfun-hyperliquid-revenue)
- Early-2025 decline: launches fell about 80% between late Jan and late Feb 2025. Daily revenue dropped to "slightly above $1M". — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/pumpfun-sees-80percent-decline-in-token-launches-as-meme-coin-market-loses-momentum); [Cryptopolitan](https://www.cryptopolitan.com/pump-fun-daily-revenue-drops-memecoin/)
- Activity in 2026 was described as "80% below peak", with the memecoin market cap around $30B. — [CryptoWire](https://www.cryptowire.in/blog/memecoin-market-cap-stalls-near-30-billion-as-pumpfun-activity-sits-80-below-peak/)
- The volume figures conflict by definition: $5M per day (July) to $40M per day (Oct 2026), per AMBCrypto, against a record $2.03B in daily DEX volume on 6 Jan 2026. — [AMBCrypto](https://ambcrypto.com/pump-fun-volume-hits-40m-beats-hyperliquid-in-revenue-whales-boost-pump/); [CoinAlertNews](https://coinalertnews.com/news/2026/01/08/pump-fun-trader-losses-token-decline)

### Inferences
- Revenue of about $46M per 30 days at an effective take rate of about 1% implies several billion dollars of monthly gross trading volume. So the AMBCrypto "$40M per day" figure probably measures something narrower. This is my inference, not a sourced number.

### Gaps
- I found no clean time series of daily active traders. Pull it from Dune (e.g. the adam_tehc pump.fun dashboard) or from the DefiLlama API (api.llama.fi/protocol/pump.fun) for exact series.

## Q4. Traditional tokenization models (STOs, real-estate tokens, revenue-share) and holder outcomes

### Takeaway
STOs from 2017–2020 gave widely dispersed returns and very poor liquidity. Only 6.4% of STOs (13.2% of successful ones) ever traded freely. Income-producing real-estate tokens like RealT delivered steady yields of about 10–14% with modest price appreciation. Speculative equity-like tokens such as tZERO's TZROP swung between −64% and +205% depending on window.

### Cited Findings
- 138 STOs (Mar 2017–Dec 2020): returns are "extremely positive and negative" over short horizons, and the tokens are less liquid than alternative investments. — [Springer, Review of Managerial Science / signaling paper](https://link.springer.com/article/10.1007/s11573-023-01175-3)
- Only 6.4% of STOs (13.2% of successful STOs) trade freely. — [Lambert et al., Small Business Economics](https://link.springer.com/article/10.1007/s11187-021-00539-9)
- tZERO's STO raised $134M at a $1.5B valuation (Aug 2018). tZERO operates an ATS; INX runs an ATS plus a broker-dealer. — [KTH thesis](https://kth.diva-portal.org/smash/get/diva2:1764927/FULLTEXT01.pdf)
- Secondary returns over the first 18–24 months (2019–2020): RealT Audubon +52.93% (+10.38% APY), RealT Marlowe +8.59% (+12.39% APY), TZROP −63.75% (the largest loser). — [Crypto Research Report](https://cryptoresearch.report/crypto-research/what-returns-have-security-tokens-provided/)
- TZROP was up about 4.5× and OSTKO about 3.5× YTD in Sep 2020. Full-year 2020 TZROP: +205.26%. — [Kyle Sonlin, Sep 2020](https://medium.com/@KyleSonlin/security-token-market-unfazed-by-lower-trading-volumes-september-2020-review-e4c5fce05b14); [Forbes Jan 2021](https://www.forbes.com/sites/nisaamoils/2021/01/25/security-token-industry-in-2021/)
- RealT: mean expected yield about 11%. RealT keeps about 5% of each property's tokens to support secondary liquidity. Rent is paid daily or weekly in USD stablecoin. One property analysis cites a 13.9% annual return. — [KTH thesis](https://kth.diva-portal.org/smash/get/diva2:1764927/FULLTEXT01.pdf)
- Secondary trading of security tokens in 2019 was thin. — [Kyle Sonlin 2019 analysis](https://medium.com/@KyleSonlin/security-token-market-secondary-trading-analysis-2019-ca0d567e7185)
- Virtuals agent tokens: 1% tax with creator/treasury split (see Q1). Clanker sends about 60% of revenue to buybacks. These are the closest memecoin-world analogs to revenue sharing. — [Forkast](https://forkast.news/virtuals-ecosystem-tokenized-agent-revenue-market-dynamics/); [TechFlow](https://www.techflowpost.com/en-US/article/33875)

### Inferences
- For a dividend-PE token model, the main risk the data supports is illiquidity (most STOs never trade freely), not total loss. Cash yield (about 8–12% in real-estate analogs) can be simulated as a low-variance income stream on top of a thin, discount-to-NAV secondary market.

### Gaps
- I found no recent (2024–2026) systematic data on Lofty yields, Republic Note, or INX secondary spreads and volumes. I also found no academic study of RealT default or vacancy rates. RealT has publicly faced Detroit code-enforcement and litigation issues, which I did not verify here.
- I found no quantitative holder-return data for Virtuals agent-token buybacks.

## Q5. Suggested simulation parameters (derived; each is tied to the sources above)

### Takeaway
Model each launch as a Poisson arrival, then a Bernoulli graduation draw with p ≈ 1% (range 0.6–2%), then a heavy-tailed jump price path with very fast decay. Model wallet P&L as a negative-sum distribution with a power-law right tail. Contrast this with a PE dividend token: low-variance yield and illiquidity-driven exit discounts.

### Cited Findings (anchor values)
- Launch rate: about 22k per day (Sep 2025), about 33k per day (Aug 2026), with troughs of 5–15k per day and a Jan 2025 peak of about 72k per day (Solana-wide). — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1); [CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/); [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/pumpfun-sees-80percent-decline-in-token-launches-as-meme-coin-market-loses-momentum)
- Graduation probability: 0.63% (Sep 2025) to 1.89% (lifetime, May 2026); 2.55% conditional on at least 30 swaps. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1); [CoinPaprika](https://coinpaprika.com/education/token-graduation-mean-numbers/)
- Time to graduation: median about 4.4 minutes and about 457 trades. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- Dump probability: 92% of active tokens have at least one dump. — [arXiv 2602.14860](https://arxiv.org/html/2602.14860v1)
- Post-graduation: median 10-minute drawdown about −50%; P(touching −80% within 10 minutes) = 38%. — [DEV/launchtape](https://dev.to/launchtape/what-2193-pumpfun-graduations-did-in-their-first-10-minutes-and-what-it-means-for-your-bot-4f70)
- Wallet outcomes: P(loss) about 0.50–0.60; P(more than $100k gain) about 0.12%; P(more than $1M gain) about 0.007% (311 of 4.26M). — [BeInCrypto](https://beincrypto.com/pump-fun-trading-data-majority-lose-money/)

### Inferences (proposed distributions; my modeling choices, not sourced facts)
- **Launch rate:** Poisson with a regime-switching mean λ ∈ {5k, 20k, 40k, 70k} launches per day (bear / normal / hot / mania), Markov transitions on a scale of weeks.
- **Graduation:** Bernoulli(p), with p ~ Beta(α≈2, β≈180) (mean about 1.1%, 90% range about 0.2–2.6%). Optionally make p a logistic function of first-30-minute buyer count.
- **Curve-phase price:** a deterministic function of cumulative net SOL x, P = (30+x)²/(30·1.073e9). Net flow follows a compound Poisson process with log-normal buy sizes (median about 0.3–1 SOL, an assumption) and sell pressure that rises with time since launch.
- **Abandonment hazard:** about 79% of tokens are dead after day 1, so use an exponential hazard with daily survival of about 0.21, i.e. a half-life of about 10–11 hours.
- **Post-graduation path:** Merton jump-diffusion or a Hawkes self-exciting jump process with strong negative drift. Calibrate so that the median 10-minute minimum is −50%, P(−80%) = 0.38, and about 95% of value is lost from peak over a year (whole-memecoin data). Use Pareto-tailed upward jumps (tail index α ≈ 1.5–2) to produce rare 100× winners.
- **Sniper share:** no reliable source exists. Parameterize sniper/insider share of supply ~ Beta with mean about 10–20% and test sensitivity across 0–90% (the Bubblemaps case studies show up to 90%). Flag this clearly as an assumption.
- **Wallet P&L:** a mixture model. About 55% of wallets draw losses from a log-normal (median loss about $100–300, consistent with 56.6% losing between $0 and $1k). About 45% draw gains from a Pareto distribution with x_min about $10 and α ≈ 1.1–1.3, tuned so that P(more than $100k) ≈ 0.12%. Constrain total P&L to equal minus (fees + platform revenue + creator take).
- **Fees:** 1.25% per swap on the curve. Creator fee on PumpSwap: 0.95% → 0.05% by market-cap tier.
- **PE dividend comparator:** annual yield ~ Normal(9%, 2%), truncated at 0, using RealT's about 10–12% as an optimistic anchor. NAV drift ~ N(2–5%, 10–15%) per year. Secondary liquidity: P(tradable) about 0.1–0.3, with an exit discount to NAV of 10–30% (an assumption; the 6.4–13.2% free-trading figure supports low liquidity).

### Gaps
- The sniper/insider share and the post-graduation 24h/7d/30d return distributions rest on assumptions. A Dune or Flipside pull would be needed to calibrate them.
- Buy-size distributions per trade on pump.fun were not found in the sources I reviewed.
