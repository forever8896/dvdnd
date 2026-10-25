Design the complete interface for a web app: every screen, for desktop and mobile, in light and dark mode.

## The product

**dvdnd** (always lowercase; the name reads "dividend" with the vowels taken out) is tokenized private equity on Stellar. Design a wordmark for it. Profitable, real-world small and mid-sized businesses raise money by selling a share of their future profits to investors worldwide, outside the US. Investors who hold and lock their tokens get paid dividends in USDC (a dollar stablecoin).

It's the opposite of the memecoin "launchpad" culture (pump.fun etc.). Calm, long-term, cash-flow-backed investing. It's built for a Stellar hackathon, but it should look like a real, regulated fintech product.

How it works:
1. **A company signs up.**
   - It proves it owns a real business: company registry lookup and domain verification.
   - It signs an agreement committing X% of yearly profits to token holders.
2. **The company opens a raise.**
   - The raise has a fixed price (1.00 USDC per token), a minimum and maximum amount, and a deadline.
   - The price is set by a target yield. Example: $105k/yr of committed profit at an 18% target yield means a $583k raise.
3. **Investors put USDC into escrow.**
   - If the minimum is reached by the deadline, the company receives the money minus a 5% platform fee, and investors receive their tokens.
   - If not, everyone is refunded automatically. All-or-nothing.
4. **After the raise, investors trade with each other** on a secondary market (an order book). The company is not involved.
5. **Dividends.**
   - Holders lock tokens for each dividend period (quarterly, semi-annual or annual).
   - At the end of the period, the company deposits X% of its profits in USDC. Only tokens locked for the full period share it, pro-rata.
   - Holders claim their USDC or cash out to their bank.
6. **Compliance.**
   - Investors must prove they are not US residents. They do this with a zero-knowledge proof generated in their browser from a KYC credential, so the app never publishes who they are. Only that they're eligible.
   - Once verified on-chain, their wallet is approved to hold tokens.
7. **Wallets use passkeys** (Face ID / fingerprint). No seed phrases, no gas fees (sponsored). Users should never need crypto knowledge.

## Audience and tone

- **Investors:** non-US retail and semi-professional investors who want yield from real businesses. Smart, but not crypto-native.
- **Companies:** owners of profitable businesses (bakeries, gyms, logistics firms, breweries) in Europe, Latin America and Africa.

The feeling: a private bank's clarity and seriousness, with modern fintech ease. Trustworthy, quiet, numbers-first.

Avoid crypto aesthetics:
- no neon on black, purple gradients or rocket emojis
- no "to the moon" energy
- no hype countdowns

Use plain words: "Invest", "Lock", "Claim dividend", "Cash out". Not "stake", "mint" or "gas". Explain anything technical in one line, with an optional "Details" link that shows the on-chain transaction (a Stellar testnet explorer link).

## Visual direction

- **Typography:** pick a distinctive but sober type pairing. Numbers matter most: use tabular figures, and give money and yield figures a clear hierarchy.
- **Color:**
  - One calm accent color.
  - Semantic colors: green for dividends and money flowing to the user, amber for pending or locked, red only for failures.
  - A deliberate neutral palette, not default grey.
- **Themes:** design light and dark with equal care.
- **Status:** show state in form, not only in text. Use pills or chips for raise status (Open / Funded / Refunding / Trading), eligibility (Verified / Expired / Not eligible) and lock status.
- **Charts:** calm and precise, with faint grids, an emphasized endpoint and no 3D.
- **Layout:** desktop sidebar or top nav. On mobile, a bottom tab bar for investors.
- **Trust details:** a small "Verified on Stellar" mark with the transaction link, a shield icon for eligibility, and an agreement hash shown in monospace.

## Sample data (fictional, use throughout)

| Company | Country | Sector | Net profit/yr | Committed | Target yield | Raise | Status |
|---|---|---|---|---|---|---|---|
| Harbor & Hearth Bakeries (4 shops) | Portugal | Food | $210k | 50% | 18% | $583k max / $350k min | Open: $412k raised, 318 investors, 9 days left |
| Northline Fitness (3 gyms) | Estonia | Fitness | $340k | 40% | 15% | $907k max / $500k min | Open: $188k raised, 6 days left |
| Kora Last-Mile Logistics | Kenya | Logistics | $150k | 60% | 22% | $409k max / $250k min | Funded, closing in 2 days |
| Andes Craft Brewing | Chile | Beverages | $260k | 50% | 18% | $722k (fully funded) | Trading: last price 1.08 USDC, 2 dividends paid ($0.088 and $0.091 per token) |
| Solenne Skin Clinic | France | Health | $95k | 50% | 18% | $264k / $150k min | Refunding: missed minimum |

Example investor:
- Verified (residence: Portugal), credential valid to Mar 2027.
- 1,240 USDC available.
- Holds 5,000 Andes tokens (4,000 locked until 31 Dec 2026, 1,000 unlocked).
- 3,000 USDC in escrow for Harbor & Hearth.
- 352.00 USDC dividend ready to claim (4,000 locked × $0.088).

## Screens to design

### Public
1. **Landing page.**
   - Thesis headline about owning a share of real, profitable businesses and getting paid in dollars.
   - How it works in 3 steps, for investors and for companies.
   - A live "open raises" strip.
   - A contrast section: dividends from real profits vs. memecoin launches, with a few stats (about 1% of pump.fun tokens graduate, about 60% of active traders lost money).
   - FAQ and footer with "Not available to US residents".
2. **Sign-in chooser.** Two clear paths: "I'm an investor" / "I'm raising for my company". Passkey sign-in or create.

### Investor
3. **Create wallet with passkey.** One step, plain explanation, success state.
4. **Eligibility flow** (multi-step, with progress):
   - a. Residence and ID check (KYC vendor style; upload or hand off to the vendor).
   - b. "Credential issued".
   - c. "Generating your private proof" in the browser, with progress and a short explainer: "we prove you're not a US resident without publishing your identity".
   - d. "Verifying on Stellar" pending.
   - e. "You're eligible" with a transaction link.
   - Also a per-session confirmation: "I'm currently outside the United States".
   - Include the failure state "Not eligible: US residents can't invest" and an expired-credential state.
5. **Marketplace / Discover.**
   - Grid or list of companies with: logo, name, country flag, sector, target yield, raise progress bar (min marker and max), days left, status pill.
   - Filters: status, sector, country, yield range. Sort options.
   - A separate tab for "Trading" companies (secondary market), with last price and implied yield.
6. **Company detail page** (the most important screen):
   - Header: name, country, sector, links and socials, verification badges (registry verified, domain verified, agreement signed with a monospace hash).
   - Key numbers: net profit, % committed, dividends per year, target yield, price per token, dividend schedule.
   - Tabs: Overview (story, team, photos), Financials (revenue/profit chart over 3 years, uploaded reports), Agreement (terms summary, PDF, on-chain hash), Dividends (history table, next expected date), Holders (count, % locked).
   - A sticky raise panel showing progress, min/max, deadline, "Invest" button and an all-or-nothing explainer. For trading companies it becomes a trade panel instead.
7. **Invest flow (modal or sheet).**
   - Inputs: amount in USDC, tokens received, expected yearly dividend at the target yield, ownership share of the profit pool.
   - Rules: "Funds held in escrow. Refunded in full if the minimum isn't reached by [date]".
   - Steps: confirm with passkey, pending, success.
   - Success shows the escrow receipt: amount, date, transaction link.
8. **Trade screen** (secondary market):
   - Simple buy/sell with an order book depth view, recent trades and price chart.
   - "Pay with" selector (USDC, XLM), since any asset is converted automatically.
   - Show implied yield at the current price.
   - Simple mode by default, advanced order book on toggle.
9. **Portfolio.**
   - Total value, total dividends earned, claimable now (prominent Claim button).
   - Holdings table: company, tokens, locked/unlocked, value, yield on cost.
   - Escrow positions (pending raises, with refund status), and upcoming dividend dates.
10. **Lock flow.**
    - Choose the amount to lock for the current period, then see unlock date and expected dividend.
    - Clear rule: "only tokens locked for the whole period earn this period's dividend".
    - Locked positions show a countdown.
11. **Claim dividend flow.** Claim USDC, then a success state with a "Cash out to bank" suggestion.
12. **Cash / Wallet.**
    - USDC and XLM balances.
    - Add money and Cash out to bank. These hand off to a partner on-ramp (MoneyGram or a regional bank partner) shown in an embedded panel.
    - Transaction history with types (Invest, Refund, Dividend, Trade, Deposit, Withdrawal) and explorer links.
13. **Profile and settings.** Eligibility status and credential expiry (re-verify), passkeys and devices, notifications, legal notices.

### Company
14. **Company onboarding.**
    - Business details, registry lookup (search, then select a match and show directors), confirm you're a director.
    - Domain verification: add a DNS TXT record, with copy button and a "Check" button.
    - Status: Verified / Pending / Failed.
15. **Profit agreement.**
    - Set the % of profit committed (slider) and the dividend schedule.
    - Read a plain-language summary of obligations, including "If the business is sold, the obligation transfers to the buyer".
    - Sign with passkey, then show the agreement hash.
16. **Raise setup.**
    - Inputs: last-year net profit, % committed, target yield.
    - The app calculates the yearly dividend pool, the maximum raise, token count at 1.00 USDC and the net to company after the 5% fee.
    - Set minimum, deadline, optional pool seeding toggle.
    - Preview how the listing will look, then publish.
17. **Company dashboard.**
    - Raise progress (live), investors count, escrowed USDC, days left.
    - After close: funds received, holders, % of tokens locked, next dividend due date and estimated amount.
    - Tasks checklist (upload financials, next dividend).
18. **Pay dividend flow.**
    - Enter the period's net profit and upload the report. The app shows X% due, amount per locked token and number of eligible holders.
    - Fund with USDC from the company's balance, or deposit through the business on-ramp (Circle).
    - Distribute, then a success state with the transaction link.
    - Include a late-payment warning state.
19. **Company reports and settings.** Uploaded financials, profile and links editing, team members.

### Simulation (separate page, linked from the landing page and the nav)
20. **"Dividends vs. memecoins" interactive simulation.** Use a scientific-instrument feel, but keep it beautiful and readable.
    - **Left: controls.** Number of traders, target yield, % profit committed, lock period, company failure rate, fraud rate, memecoin launch regime. Plus Run / Reset.
    - **Main area: charts.**
      - a. Profit-and-loss distribution of traders, dividend model vs. memecoin (overlaid).
      - b. Where the money goes (stacked bar: to companies, to holders as dividends, platform fees, to snipers/insiders).
      - c. Investor return heatmap by target yield × % committed.
      - d. Secondary price vs. fair value over dividend periods.
      - e. Inequality (Lorenz curves) per model.
      - f. Survival over time: companies still paying vs. memecoins still trading.
    - Summary stat cards on top (median return, % of traders who lost money, share of money reaching real businesses), with a short plain-language takeaway for each chart.
    - Show it mid-run with realistic results, not empty.

### Shared states and components
- Transaction toasts: pending, confirmed with link, failed with reason and retry.
- Empty states (no holdings yet, no raises match filters).
- Loading skeletons.
- Raise outcome banners: Funded, Refunding.
- The "Not available in the US" geo notice.
- Components: buttons, inputs with currency suffix, progress bar with min marker, status pills, data tables, number cards, chart styles, modals and sheets.

Deliver a coherent design system (colors, type scale, spacing, components) and all screens above, with the realistic sample data filled in.
