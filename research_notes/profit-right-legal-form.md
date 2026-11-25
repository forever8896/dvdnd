# Legal Form of the Profit Right: Country-by-Country Analysis

- **Date:** 2026-11-25
- **Jurisdiction scope:** Germany, France, the Czech Republic, and Portugal, plus Luxembourg as a pan-EU securitisation/DLT comparator and EU cross-border private-international-law overlays.
- **Repository scope boundary:** Existing documents in `reports/` and `research_notes/Stellar private equity dividend platform/` cover Stellar protocol primitives, ZK residence gating, US Reg S / Rule 506(c) framing, anchors, and bonding-curve simulations; they do **not** analyze European substantive profit-right instruments, transfer formalities, SPV structuring, or courtroom enforceability. This note addresses those four questions directly against `app/src/lib/agreement.ts` and `ARCHITECTURE.md`, and defers EU financial-instrument classification (Issue #18), ECSPR licensing (Issue #19), US Reg S / 506(c) execution (Issue #20), broker/ATS risk (Issue #21), transfer-agent rules (Issue #22), GDPR/AML (Issue #24), and cross-border dividend withholding tax (Issue #25) to their respective issues, flagging only where they constrain the legal form.

> **Disclaimer:** This is research to frame decisions, not legal advice. Final positions must be reviewed and approved by qualified counsel in each target jurisdiction.

---

## Executive Summary Matrix

| Dimension | Germany | France | Czech Republic | Portugal | Luxembourg (SPV Comparator) |
|---|---|---|---|---|---|
| **Best-fit instrument for private SMEs** | Securitised bearer *Genussschein* (debt-like profit right) — ideally as an **eWpG *Kryptowertpapier*** | Profit-linked *obligation* (participating bond, Art. L228-38 C. com.) registered in a **DEEP** | Profit-linked *dluhopis* (bond, Act No. 190/2004 Coll. § 16) — optionally subordinated (§ 34) | Profit-participating *obrigação* (CSC Art. 360(1)(a)–(b)); *associação em participação* only for bilateral/SPV leg | Compartmentalised *société de titrisation* issuing DLT dematerialised notes via a statutory *agent de contrôle* |
| **Instruments ruled out for private SMEs / retail tokens** | Unsecuritised *Genussrecht* (VermAnlG; no token transfer); *stille Gesellschaft* (bilateral, no free transfer) | *Titres participatifs* (public/co-op entities only, Art. L228-36); *prêts participatifs* (no natural-person lenders, Art. L313-13); *SEP* (unlimited-liability risk) | *Tichá společnost* (mandatory non-waivable loss-sharing, GM approval, transfer requires issuer consent) | *Títulos de participação* (public/majority-state enterprises only, DL 321/85) | Standalone dedicated SPV per SME (prohibitive annual overhead) |
| **Token move = legal transfer?** | **Only** via BaFin-licensed eWpG crypto securities register (§§ 16, 25 eWpG); bare claims need no writing (§ 398 BGB) but debtor is protected until notice (§ 407 BGB) | **Yes** for unlisted *obligations* on a compliant DEEP (Arts. L211-3, L211-17 CMF); bare claim assignment is **void without writing** (Art. 1322 C. civ.) | **No** for raw public-chain tokens; book-entry bonds require CDCP/licensed register (ZPKT); bare claims require debtor notice (§ 1882 NOZ) | **No** for bare claims (ineffective vs. debtor until notice, Art. 583 CC); DLT securities recognized in CVM (DL 66/2023) only within regulated/DLT Pilot structures | **Yes** for dematerialised securities on DLT supervised by a statutory *agent de contrôle* or central account keeper (Law of 20 Dec 2024) |
| **Insolvency ranking** | Unsecured (§ 38 InsO) or subordinated (§ 39(2) InsO); qualified subordination often needed unless bearer-bond KWG carve-out applies | Unsecured (*chirographaire*) or contractually subordinated (Art. L228-97 C. com.) | Unsecured, or subordinated (§ 172(2)–(3) Act No. 182/2006 Coll.) if issued under § 34 Bonds Act | Common unsecured (CIRE Art. 47(4)(c)) or subordinated (CIRE Art. 48(c)/(a)) | Ring-fenced per compartment (Arts. 5, 62 Securitisation Law); limited recourse & non-petition statutorily valid (Art. 64) |
| **Core tax lever (issuer level)** | Payouts tax-deductible if profit-only (no liquidation share, § 8(3) s. 2 KStG) | Bond interest deductible subject to CGI/ATAD limits; dividends non-deductible | Bond yield deductible subject to ATAD/thin-cap; silent partner share generally non-deductible | Bond interest deductible subject to CIRC Art. 67 EBITDA cap | Commitments to compartment noteholders are statutorily tax-deductible (neutral pass-through) |

---

## 1. Best-Fit Instrument by Jurisdiction

### 1.1 Germany

Germany offers the strongest domestic fit for a contractual profit right, provided it is **securitised** as a bearer debt-like instrument rather than left as a bare contract.

1. **Securitised Bearer *Genussscheine* (Profit Participation Certificates) — Best fit**
   - **Legal nature:** *Genussrechte* are purely contractual creditor rights (*schuldrechtliche Ansprüche*) conferring equity-like financial participation (profit share and optionally liquidation share) with **no voting or membership rights**. They have no exhaustive statutory definition, but are governed across [§ 221 AktG](https://www.gesetze-im-internet.de/aktg/__221.html), [§ 1 Abs. 2 Nr. 5 VermAnlG](https://www.gesetze-im-internet.de/vermanlg/__1.html), and [§ 8 Abs. 3 Satz 2 KStG](https://www.gesetze-im-internet.de/kstg_1977/__8.html).
   - **Securitised (*Genussschein*) vs. unsecuritised (*Genussrecht*):** Unsecuritised *Genussrechte* are regulated as retail capital investments (*Vermögensanlagen*) under [§ 1 Abs. 2 Nr. 5 VermAnlG](https://www.gesetze-im-internet.de/vermanlg/__1.html), which imposes heavy domestic distribution/prospectus barriers and blocks token-native transfer. By contrast, a securitised **bearer *Genussschein*** structured as a bearer bond (*Inhaberschuldverschreibung*, [§ 793 BGB](https://www.gesetze-im-internet.de/bgb/__793.html)) sits outside VermAnlG (instead under EU Prospectus Regulation [(EU) 2017/1129](https://eur-lex.europa.eu/eli/reg/2017/1129/oj)) and can be issued purely electronically as a **crypto security (*Kryptowertpapier*)** under [§ 1 eWpG](https://www.gesetze-im-internet.de/ewpg/__1.html) and [§ 16 eWpG](https://www.gesetze-im-internet.de/ewpg/__16.html).
   - **Who may issue & corporate consent:**
     - **AG / KGaA:** Requires a general meeting resolution by at least a **75% majority** of share capital represented ([§ 221 Abs. 3 i.V.m. Abs. 1 AktG](https://www.gesetze-im-internet.de/aktg/__221.html)), and existing shareholders hold statutory pre-emptive rights (*Bezugsrecht*) unless properly excluded ([§ 221 Abs. 4 AktG](https://www.gesetze-im-internet.de/aktg/__221.html)).
     - **GmbH (the core German SME form):** § 221 AktG does not apply directly, so managing directors may issue ordinary debt-like *Genussrechte* unless the articles restrict them. However, prevailing German corporate-law doctrine applies § 221 AktG *by analogy*—requiring a **75% shareholders' resolution** ([§ 53 Abs. 2 GmbHG](https://www.gesetze-im-internet.de/gmbhg/__53.html))—whenever profit-participating rights materially dilute existing shareholders' dividend entitlements. Requiring a 75% GmbH shareholder resolution should therefore be mandatory.
     - **Partnerships (OHG / KG / GmbH & Co. KG):** Permitted under the partnership agreement (default: partner consent).
   - **Investor consent to amend terms:** If issued as German-law uniform bearer bonds, the issuance terms may opt into the Bond Act (*Schuldverschreibungsgesetz*), allowing majority resolutions (typically **75%** for material economic modifications) binding on all holders ([§ 5 SchVG](https://www.gesetze-im-internet.de/schvg/__5.html)). Without SchVG opt-in, amending terms requires **100% unanimous holder consent**.
   - **Insolvency ranking & KWG deposit-taking trap:**
     - Default ranking: **general unsecured insolvency claim** ([§ 38 InsO](https://www.gesetze-im-internet.de/inso/__38.html)).
     - **Critical banking-law trap:** Accepting repayable public funds without a banking licence is prohibited deposit-taking (*Einlagengeschäft*) under [§ 1 Abs. 1 Satz 2 Nr. 1 KWG](https://www.gesetze-im-internet.de/kredwg/__1.html) **unless** either (a) the claim is securitised in bearer or order bonds (*Inhaber- oder Orderschuldverschreibungen*, expressly exempted in § 1 Abs. 1 Satz 2 Nr. 1 KWG), or (b) the agreement includes a **qualified subordination clause** (*qualifizierter Rangrücktritt*) placing claims behind all general creditors under [§ 39 Abs. 2 InsO](https://www.gesetze-im-internet.de/inso/__39.html) and barring payments that would trigger insolvency.

2. ***Stille Gesellschaft* (Silent Partnership) — Unsuitable for direct tokenization**
   - Governed by [§§ 230–236 HGB](https://www.gesetze-im-internet.de/hgb/__230.html). Any merchant (*Kaufmann*) may accept a silent partner's contribution in return for a profit share ([§ 230 Abs. 1 HGB](https://www.gesetze-im-internet.de/hgb/__230.html)).
   - **Insolvency ranking:** Under [§ 236 Abs. 1 HGB](https://www.gesetze-im-internet.de/hgb/__236.html), upon the business's insolvency the silent partner files as an unsecured creditor ([§ 38 InsO](https://www.gesetze-im-internet.de/inso/__38.html)) **only** for the portion of their contribution exceeding their share of accumulated losses (unless loss participation was excluded under § 231 Abs. 2 HGB).
   - **Disqualifiers:** Every silent partner holds statutory annual-accounts inspection rights ([§ 233 HGB](https://www.gesetze-im-internet.de/hgb/__233.html)), the bilateral partnership position cannot be transferred freely by moving a token without the issuer's consent, and public offerings are caught as *Vermögensanlagen* under [§ 1 Abs. 2 Nr. 1 VermAnlG](https://www.gesetze-im-internet.de/vermanlg/__1.html).

3. ***Partiarisches Darlehen* (Profit-Participating Loan) — Bilateral SPV leg only**
   - A loan ([§ 488 BGB](https://www.gesetze-im-internet.de/bgb/__488.html)) with profit-linked interest and no loss participation. Publicly offered unsecuritised profit-participating loans fall under [§ 1 Abs. 2 Nr. 3 VermAnlG](https://www.gesetze-im-internet.de/vermanlg/__1.html) and need a qualified subordination clause ([§ 39 Abs. 2 InsO](https://www.gesetze-im-internet.de/inso/__39.html)) to avoid KWG licensing. It works cleanly only as a **single bilateral loan from an SPV to the SME**.

---

### 1.2 France

French statutory law sharply restricts who can issue participating titles. Two frequently cited French instruments—*titres participatifs* and *prêts participatifs*—are **legally blocked** for private SMEs raising from individual investors.

1. ***Titres participatifs* — Ruled out for private commercial SMEs**
   - **Who may issue:** Under [Article L228-36 of the Code de commerce](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049720044) (as amended by Law n° 2024-537 of 13 June 2024, Art. 1), *titres participatifs* may **only** be issued by: (i) joint-stock companies in the **public sector**, (ii) **cooperatives** organised as SA, SARL, or SAS, (iii) social-housing companies (*sociétés anonymes d'HLM*), and (iv) social-housing coordination companies. **Standard private commercial SAS, SA, and SARL SMEs cannot legally issue *titres participatifs*.**
   - *(Note for French cooperatives only:)* Redeemable only on liquidation or at the issuer's option after ≥ 7 years; remuneration must combine a fixed portion and a profit/activity-linked variable portion ([Art. L228-36 C. com.](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000029328075)); holders form a statutory *masse* with civil personality and shareholder-meeting attendance rights ([Art. L228-37 C. com.](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000029328075)); deeply subordinated behind all privileged and unsecured creditors.

2. ***Obligations à intérêt participatif* / Subordinated *Obligations* (Profit-Linked Bonds) — Best fit**
   - **Legal nature:** Negotiable debt securities conferring identical creditor rights per unit of nominal value ([Art. L228-38 C. com.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329647) / Art. L213-5 CMF). The coupon may include a variable profit-linked component (commonly termed *obligations participatives*), and contractual subordination—including undated subordinated notes (*titres subordonnés à durée indéterminée*, TSDI)—is expressly authorised under [Art. L228-97 C. com.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329704).
   - **Who may issue & corporate consent:**
     - **SA, SAS, SCA:** Eligible to issue bonds. Under [Art. L228-39 C. com.](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000005634379/LEGISCTA000006161285/) (as amended by Ordonnance n° 2023-1142, effective 1 Jan 2024), share capital must be **fully paid up**, and any joint-stock company that has **not** established two regularly approved annual balance sheets must obtain an independent auditor's (*commissaire*) asset-and-liability verification report **under penalty of nullity** (*à peine de nullité*).
     - **SARL:** May issue nominative bonds *only* if it meets statutory auditor appointment thresholds and has approved its last three 12-month balance sheets (Code de commerce Art. L223-11), and may not make public offers outside statutory exemptions.
     - **Corporate authority:** The board of directors / management board / managers (or SAS president under the articles) may authorise bond issuance unless the articles reserve authority to the general meeting ([Art. L228-40 C. com.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000034799356)).
   - **Investor consent:** Bondholders of the same issue automatically form a ***masse*** with legal personality (Art. L228-46 C. com.) that votes on modifications by two-thirds majority (Art. L228-65 C. com.). For wholesale issues (nominal value ≥ €100,000 or restricted to qualified investors), the issuance contract may contractually adapt or disapply the statutory *masse* (Art. L228-90 C. com.).
   - **Insolvency ranking:** Unsubordinated *obligations* rank as **general unsecured claims** (*créanciers chirographaires*); subordinated obligations under [Art. L228-97 C. com.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329704) rank strictly behind all privileged and unsecured creditors (ahead only of shareholders).

3. ***Prêts participatifs* (Participating Loans) — Blocked for natural-person investors**
   - Under [Article L313-13 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042915235), *prêts participatifs* may **only** be granted by listed institutional/corporate lenders (the State, credit institutions, financing companies, commercial companies, authorised lending AIFs, mutuals, etc.). Individual retail investors cannot directly lend via *prêt participatif* (though an SPV structured as a commercial company could). Statutorily subordinated behind all other creditors on liquidation (Art. L313-14 CMF) with optional profit-participation clauses (Art. L313-16 CMF).

4. ***Société en participation* (SEP — Silent Partnership) — Ruled out**
   - Governed by [Articles 1871–1873 of the Code civil](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006136392). No legal personality. Disqualified because: (a) if investors act visibly as partners or the SEP becomes ostensible, commercial partners incur **joint and several unlimited liability** for business debts ([Art. 1872-1 C. civ.](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006136392)); (b) if concluded for an indefinite period, **any single partner can dissolve it at any time** by good-faith notice ([Art. 1872-2 C. civ.](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006136392)); and (c) it cannot issue negotiable tokens.

---

### 1.3 Czech Republic

Czech law has no standalone statutory *Genussrecht* or *titre participatif*. The realistic choices are **profit-linked bonds (*dluhopisy*)** or a **silent partnership (*tichá společnost*)** (with non-voting profit shares as an equity-only alternative).

1. ***Dluhopisy* (Profit-Linked / Subordinated Bonds) — Best fit**
   - **Statutory basis:** **Bonds Act, Act No. 190/2004 Coll.** (*Zákon o dluhopisech*, [e-Sbírka 190/2004 Sb.](https://www.e-sbirka.cz/sb/2004/190)). A *dluhopis* is a security or book-entry security (*zaknihovaný cenný papír*) embodying the right to repayment of a nominal principal sum and payment of a yield (*výnos*, § 2(1)). **§ 16** permits determining the yield (*výnos*) by variable benchmarks—including the issuer's profit—and **§ 34** explicitly establishes **subordinated bonds** (*podřízené dluhopisy*).
   - **Who may issue & corporate consent:** Under § 2(2) of Act No. 190/2004 Coll., **any legal entity** (including both *s.r.o.* and *a.s.*) or natural person may issue bonds. Standard (non-convertible, non-priority) bonds are authorised by the statutory body (*jednatel* / board of directors) unless the articles require general-meeting approval. (Convertible/priority bonds of an *a.s.* require a general-meeting resolution under § 485 of the Business Corporations Act, [Act No. 90/2012 Coll. (ZOK)](https://www.e-sbirka.cz/sb/2012/90).)
   - **Investor consent:** Material changes to issuance terms (*emisní podmínky*) require a resolution of the **bondholders' meeting (*schůze vlastníků*)** under §§ 21–24a of Act No. 190/2004 Coll. (three-quarters majority of votes present for core economic changes, with statutory early-redemption rights for dissenting holders in enumerated fundamental changes).
   - **Insolvency ranking:** Ordinary bonds rank as **general unsecured claims** under the **Insolvency Act, Act No. 182/2006 Coll.** ([e-Sbírka 182/2006 Sb.](https://www.e-sbirka.cz/sb/2006/182)). Subordinated bonds issued under § 34 Bonds Act rank as **subordinated claims (*podřízené pohledávky*)** under **§ 172(2)–(3) of Act No. 182/2006 Coll.**, satisfied only after all non-subordinated claims are paid in full ([CNB insolvency ranking guidance](https://www.cnb.cz/en/resolution/general-approach-of-the-czech-national-bank-to-setting-a-minimum-requirement-for-own-funds-and-eligible-liabilities-mrel/standardised-method-of-reporting-insolvency-rankings/)).
   - **Structural constraint for `dvdnd`:** Because § 2(1) Bonds Act requires a **repayable nominal amount**, a pure zero-principal perpetual profit share does *not* qualify as a statutory *dluhopis* (falling back to an innominate contract under § 1746(2) Civil Code with no security negotiability). Pairing a modest nominal principal/maturity with a profit-linked variable yield (§ 16) satisfies the statute.

2. ***Tichá společnost* (Silent Partnership) — Bilateral SPV leg only**
   - **Statutory basis:** **Czech Civil Code, Act No. 89/2012 Coll., §§ 2747–2755** ([e-Sbírka 89/2012 Sb.](https://www.e-sbirka.cz/sb/2012/89)).
   - **Who may issue & mandatory GM consent:** Any entrepreneur (*podnikatel*). Critically, for both a Czech *s.r.o.* and *a.s.*, entering into a silent partnership agreement—or **any other contract establishing a right to a share of profit**—requires **general meeting approval** under [ZOK, Act No. 90/2012 Coll.](https://www.e-sbirka.cz/sb/2012/90) (§ 190(2)(j) for *s.r.o.*, § 421(2)(o) for *a.s.*).
   - **Loss-sharing & insolvency ranking:** Under **§§ 2751(1) and 2753(1) Civil Code**, the silent partner shares in losses equally with profits up to their contribution, and **any clause excluding loss participation is disregarded (void)** (*k opačnému ujednání se nepřihlíží*). Under **§ 2754(2)(c) and § 2755 Civil Code**, a declaration of insolvency dissolves the silent partnership and the silent partner claims as an **unsecured insolvency creditor** for their contribution adjusted by accumulated profit/loss shares.
   - **Why unsuitable for direct tokenization:** Individual statutory inspection rights over accounting records (§ 2749 Civil Code), non-fungible bilateral contract (transfer requires entrepreneur consent under § 1895 Civil Code), and non-deductible profit distributions at the SME level.

3. **Non-voting priority shares / *Kmenový list* (Equity alternative)**
   - An *a.s.* may issue non-voting priority shares (*prioritní akcie*, ZOK §§ 276–278) and an *s.r.o.* may issue transferable share certificates (*kmenový list*, ZOK § 137). Both are true corporate equity—sitting last in insolvency, requiring notarised articles amendments and Commercial Register updates, and outside contractual profit-right design.

---

### 1.4 Portugal

Like France, Portugal restricts its statutory participation certificates to state/public enterprises, making **profit-participating bonds (*obrigações participantes*)** the sole negotiable private-SME option and **associação em participação** a bilateral-only tool.

1. ***Títulos de participação* — Ruled out for private SMEs**
   - Governed by [**Decreto-Lei n.º 321/85, de 5 de agosto**](https://diariodarepublica.pt/dr/detalhe/decreto-lei/321-1985-180193). Article 1.º restricts issuance exclusively to **public enterprises (*empresas públicas*) and companies with majority State capital**. Private SMEs cannot issue them.

2. ***Obrigações com juro suplementar dependente dos lucros* (Profit-Participating Bonds) — Best fit**
   - **Statutory basis:** **Código das Sociedades Comerciais (CSC)** ([Decreto-Lei n.º 262/86](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1986-34443975)), Articles **348.º–372.º**. **Artigo 360.º(1)(a)–(b) CSC** expressly permits bonds granting, alongside fixed interest, a supplementary interest or redemption premium dependent on company profits, or an interest and repayment plan dependent on profits (regulated by Arts. 361.º–362.º CSC).
   - **Who may issue & corporate consent:**
     - **Sociedades Anónimas (SA):** Eligible under Arts. 348.º–350.º CSC.
     - **Sociedades por Quotas (Lda — standard Portuguese SME):** Expressly authorised to issue bonds under [**Decreto-Lei n.º 160/87, de 3 de abril**](https://diariodarepublica.pt/dr/detalhe/decreto-lei/160-1987-666356), applying the SA bond regime *mutatis mutandis*.
     - **Preconditions & approvals:** Share capital must be fully paid up and the company registered for at least 1 year (Art. 348.º(1) CSC, subject to statutory exceptions). Total bond issuance is capped at **twice equity (*capitais próprios*)** under Art. 349.º CSC unless exempt (e.g., collateralised, rated, or offered only to qualified investors / ≥ €100k denominations). Requires a **shareholders' general meeting resolution** unless the articles delegate authority to management (Art. 350.º CSC).
   - **Investor consent:** Bondholders form a statutory **bondholders' assembly (*assembleia de obrigacionistas*)** with a common representative (*representante comum*, Arts. 355.º–359.º CSC); material amendments require qualified assembly majorities (Art. 355.º(4)–(5) CSC).
   - **Insolvency ranking:** Under the Insolvency and Corporate Recovery Code (**CIRE**, Decreto-Lei n.º 53/2004; [CIRE, DL n.º 53/2004](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2004-34529075)), ordinary bonds rank as **common unsecured claims (*créditos comuns*)** (Art. 47.º(4)(c) CIRE). They rank as **subordinated claims (*créditos subordinados*)** under **Art. 48.º CIRE** if contractually subordinated (Art. 48.º(c)) or held by persons specially related to the debtor (Art. 48.º(a)).

3. ***Associação em participação* (Portuguese Silent Partnership) — Bilateral SPV leg only**
   - **Statutory basis:** [**Decreto-Lei n.º 231/81, de 28 de julho**](https://diariodarepublica.pt/dr/detalhe/decreto-lei/231-1981-579479), Articles **21.º–32.º**. An *associado* associates with an *associante*'s economic activity in exchange for a share in profits (and optionally losses, Art. 21.º(1)–(2)).
   - **Form & accounts:** Under **Art. 23.º(1) DL 231/81**, no special form is required unless asset transfers demand it, **except** **Art. 23.º(2)** requires **written form** for any clause excluding the *associado* from losses or establishing unlimited liability. **Art. 31.º** obligates the *associante* to render annual accounts (upon which payment entitlement crystallises).
   - **Insolvency & transferability:** Insolvency of the *associante* terminates the contract (**Art. 27.º(g) DL 231/81**); the *associado*'s residual claim for unconsumed contribution / accrued unpaid profit ranks as an unsecured claim (unless subordinated or related-party under Art. 48.º CIRE). Purely bilateral and *intuitu personae*: cannot be tokenized directly, and assigning the contractual position requires *associante* consent (Portuguese Civil Code Art. 424.º).

---

### 1.5 Pan-EU Comparator: Luxembourg Compartmentalised Securitisation SPV + DLT Control Agent

Because Czechia and Portugal lack open domestic DLT security statutes, **Luxembourg** is the key pan-EU comparator:

- **Statutory ring-fenced compartments:** Under the [**Law of 22 March 2004 on Securitisation (consolidated 2024)**](https://legilux.public.lu/eli/etat/leg/loi/2004/03/22/n1/consolide/20240722) (as modernized by the [Law of 25 February 2022](https://legilux.public.lu/eli/etat/leg/loi/2022/02/25/a84/jo)), one *société de titrisation* can establish **unlimited statutory compartments** (**Art. 5**), each corresponding to one SME's bilateral profit-right contract. Each compartment is statutorily ring-fenced from every other compartment (**Arts. 33, 62**), and non-petition / limited-recourse / subordination clauses are enforceable by law (**Art. 64**).
- **Eligible underlying assets:** **Art. 53** expressly allows securitising risks inherent in third-party business activities—including contractual profit-share receivables or bilateral loans/partnerships—and **Art. 55** renders present and future claim assignments effective against third parties upon signing without formalities (subject to the governing law of the assigned claim, Art. 58).
- **DLT issuance via *agent de contrôle*:** Luxembourg's [**Law of 20 December 2024**](https://legilux.public.lu/eli/etat/leg/loi/2024/12/20/a597/jo) (Blockchain Law IV, amending the Law of 6 April 2013 on dematerialised securities) allows issuers of DLT dematerialised debt and equity securities to appoint a single **control agent (*agent de contrôle*)** supervising the issuance account directly on DLT, while **Art. 16(3)** provides that payment of distributions to the paying agent for delivery to the holders designated by the control agent legally discharges the issuer—an almost exact statutory mirror of `dvdnd`'s `compliance` account + `vault` model.
- **CSSF licensing threshold:** Under **Art. 19** of the Securitisation Law (as amended in 2022), CSSF authorisation is triggered if the vehicle issues financial instruments **to the public on a continuous basis**—defined as **more than 3 public issues per financial year** (where an issue is not restricted to professional clients, has denominations below €100,000, and is not a private placement).

---

## 2. Token Transfer vs. Written Assignment or Notice

`dvdnd` relies on Stellar's `AUTH_REQUIRED` classic asset + SAC so that moving tokens between authorized wallets transfers the economic right (`ARCHITECTURE.md`). **Across all four jurisdictions, moving a raw token does NOT automatically transfer a bare contractual profit right with full legal effect.** Only statutory electronic/DLT securities achieve token-native legal transfer.

| Jurisdiction | Bare Contractual Claim (Civil-Law Assignment) | Statutory Electronic / DLT Security Path | Does Moving a Raw Stellar Token Transfer Legal Title? |
|---|---|---|---|
| **Germany** | Form-free assignment ([§ 398 BGB](https://www.gesetze-im-internet.de/bgb/__398.html)), **but** issuer is legally discharged if it pays the prior holder before knowing of the transfer ([§ 407 BGB](https://www.gesetze-im-internet.de/bgb/__407.html)). Transfer of an entire contract (e.g., silent partnership) requires counterparty consent ([§ 415 BGB](https://www.gesetze-im-internet.de/bgb/__415.html) analogy). | **eWpG Crypto Securities** ([§§ 1, 2(3), 4(3), 16, 24–25 eWpG](https://www.gesetze-im-internet.de/ewpg/__1.html)): bearer *Inhaberschuldverschreibungen* (including bearer *Genussscheine*) are deemed tangible property (*Sache*); ownership passes by agreement + register entry ([§ 25 eWpG](https://www.gesetze-im-internet.de/ewpg/__25.html)) with good-faith acquisition ([§ 26 eWpG](https://www.gesetze-im-internet.de/ewpg/__26.html)). **Requires a BaFin-licensed crypto securities registrar** ([§ 1 Abs. 1a Satz 2 Nr. 8 KWG](https://www.gesetze-im-internet.de/kredwg/__1.html); [BaFin Merkblatt 03/2023](https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Merkblatt/mb_231114_tatbestand_kryptowertpapierregisterfuehrung.html)). | **No** without a BaFin-licensed eWpG registrar. **Yes** if Stellar is operated as a compliant eWpG register by a licensed registrar. |
| **France** | **Writing mandatory under penalty of nullity** (*à peine de nullité*, [Art. 1322 C. civ.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042021)). Enforceable against the issuer only upon notification or acknowledgement unless the issuer consented in advance ([Art. 1324 C. civ.](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000032032400/)). | **DEEP / DLT Regime** ([Art. L211-3 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367135) & [Art. L211-17 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367110), enacted by Ordonnance n° 2017-1674 & modernized by Ordonnance n° 2024-936, in force 30 Dec 2024): unlisted *obligations* registered in a DEEP transfer ownership **upon on-chain recording**, without written assignment, provided Art. R211-9-7 CMF integrity and **owner-identification** rules are met. | **No** for bare contracts (**void** under Art. 1322 C. civ.). **Yes** for unlisted French *obligations* if Stellar + issuer's compliance agent satisfies DEEP / Art. R211-9-7 CMF. |
| **Czech Republic** | No statutory written form since 2014 ([Act No. 89/2012 Coll., §§ 1879–1881](https://www.e-sbirka.cz/sb/2012/89)), **but** debtor validly pays the original creditor until notified by assignor or proved by assignee (§ 1882(1)). Assigning a whole contract requires debtor consent (§ 1895). | Book-entry bonds (*zaknihované dluhopisy*) transfer **only** via registration in a statutory register—CDCP or licensed central/separate register under [Act No. 256/2004 Coll. (ZPKT)](https://www.e-sbirka.cz/sb/2004/256) (§§ 92–97). **No domestic eWpG/DEEP equivalent** exists outside the EU DLT Pilot Regime ([Regulation (EU) 2022/858](https://eur-lex.europa.eu/eli/reg/2022/858/oj)). | **No** for native Stellar transfers. Requires an SPV wrapper or issuing under German/French/Luxembourg DLT securities law. |
| **Portugal** | Assignment (*cessão de créditos*, Código Civil Arts. 577.º–583.º) follows the form of the underlying act (Art. 578.º), **but** has **no effect against the debtor until notified or accepted** (Art. 583.º(1)). Assigning an *associação em participação* requires *associante* consent (CC Art. 424.º). | [**Decreto-Lei n.º 66/2023**](https://diariodarepublica.pt/dr/detalhe/decreto-lei/66-2023-216771968) amended the Código dos Valores Mobiliários (CVM) to implement EU Regulation 2022/858 (DLT Pilot Regime), recognizing DLT book-entry securities. Outside an authorised DLT Pilot infrastructure (DLT MTF / SS / TSS), CVM book-entry registration still requires an authorised financial intermediary or CSD. | **No** on open Stellar DEX outside a regulated DLT Pilot infrastructure or CSD/SPV bridge. |

### Two architectural conflicts exposed by transfer law

1. **ZK session deletion breaks statutory DLT registers:** Both Germany ([§ 17 Abs. 1 Nr. 6 & Abs. 2 eWpG](https://www.gesetze-im-internet.de/ewpg/__17.html) — register must record the *Inhaber*) and France (Art. R211-9-7 CMF — DEEP must allow identification of security owners) — as well as Luxembourg's [Law of 20 December 2024](https://legilux.public.lu/eli/etat/leg/loi/2024/12/20/a597/jo) (control agent supplies holder identification data to the issuer) — require the registrar/control agent to be able to identify legal owners off-chain. `dvdnd`'s current Didit flow deletes the identity session once the ZK proof is registered (`ARCHITECTURE.md`), which makes the token **ineligible** as a compliant eWpG, DEEP, or Luxembourg DLT security.
2. **Defences and set-off contagion on bare claims:** Even if a contract tried to treat the Stellar ledger as "advance consent + notice" under German (§ 407 BGB), Czech (§ 1882 NOZ), or Portuguese (Art. 583 CC) assignment law, bare assigned claims carry **no good-faith acquisition** (*gutgläubiger Erwerb*): every secondary buyer inherits all defences, nullities, and set-offs the SME had against prior holders (German [§ 404 BGB](https://www.gesetze-im-internet.de/bgb/__404.html), French Art. 1324(2) C. civ., Czech § 1884 NOZ, Portuguese Art. 585.º CC). Only a statutory negotiable security cuts off prior-holder defences.

---

## 3. Direct Contract vs. SPV per Company (vs. Multi-Compartment SPV)

| Factor | Option A: Direct Contract / Direct Issuance (SME ↔ Token Holders) | Option B: Dedicated SPV per Company | Option C: Independent Multi-Compartment Securitisation SPV (e.g., Luxembourg) |
|---|---|---|---|
| **Enforceability** | **Weak unless wrapped as a statutory bond with a Common Representative.** Fragmented retail holders face prohibitive cross-border litigation costs; bare-claim chain of title fails in FR/CZ/PT. | **Strong.** Single creditor entity holds the SME contract, audit rights, and security; enforces centrally in local court. | **Strong.** Each compartment is the sole creditor of its SME with statutory ring-fencing ([Arts. 5, 33, 62 Lu. Securitisation Law](https://legilux.public.lu/eli/etat/leg/loi/2004/03/22/n1/consolide/20240722)) and enforceable non-petition/limited recourse (Art. 64). |
| **Cost** *(all euro figures below are illustrative market estimates, unverified)* | **Lowest upfront** (~€5k–€15k per jurisdiction template), **highest cross-border legal complexity** (4 different corporate/bond regimes; 4 registrar setups). | **Prohibitive for SMEs.** Forming, auditing, administering, and winding down one SPV per SME costs ~**€15k–€40k/year** (registered office, directors, audit, tax returns) — viable only for ≥ €3M–€5M raises, not €250k–€1M SME raises. | **Amortized fixed cost.** One Luxembourg vehicle (~€40k–€80k setup + ~€30k–€60k/yr base admin/audit, higher if CSSF-authorised) + ~**€5k–€15k** per added compartment. Beats per-company SPVs from ~3–5 raises onward. |
| **Tax** | **Strong issuer deductibility when structured as pure debt-like profit right:** e.g., Germany allows corporate tax deduction for *Genussrechte* with profit participation **only** (no liquidation share, [§ 8 Abs. 3 Satz 2 KStG](https://www.gesetze-im-internet.de/kstg_1977/__8.html); [BFH 14.08.2019, I R 44/17](https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE202010104/)). **Severe WHT burden:** SME must manage cross-border WHT across hundreds of wallets (see Issue #25). | **Tax leakage / double-WHT risk:** SPV profit-right income may be taxed at SPV level unless matched with deductible interest/commitments, constrained by EU ATAD interest-limitation rules (30% EBITDA / €3M safe harbour, [Directive (EU) 2016/1164, Art. 4](https://eur-lex.europa.eu/eli/dir/2016/1164/oj)). | **Statutorily tax-neutral SPV:** Commitments to pay out compartment proceeds to noteholders are deductible under Luxembourg securitisation tax law (minimizing SPV-level corporate tax leakage). Cross-border WHT on SME → Luxembourg leg still requires treaty/EU directive analysis (Issue #25). |
| **Fit with `dvdnd`'s "software, not broker" stance** | **High.** SME is the sole issuer; `dvdnd` stays strictly software. | **Medium–Low.** If `dvdnd` forms/manages SPVs, `dvdnd` takes on arranger/issuer/AIFM risk. | **High ONLY if operated by an independent regulated third-party securitisation/tokenization provider** (white-label issuer); otherwise triggers Luxembourg CSSF authorisation (>3 public issues/yr under Art. 19) and MiFID/broker risk (Issue #21). |

**Bottom line on structure:** **Dedicated SPV per company fails SME unit economics.** Use **Direct Statutory DLT Issuance** (German eWpG *Genussschein* or French DEEP *obligation*) for single-country launches, and use an **independent Multi-Compartment Securitisation SPV** when expanding across Czechia, Portugal, and pan-EU SMEs.

---

## 4. What the Agreement Must Contain to Enforce Payment in Court

### 4.1 Clause-by-Clause Audit of `app/src/lib/agreement.ts`

`dvdnd`'s current agreement (`app/src/lib/agreement.ts`) consists of 6 plain-language sentences hashed onto `registry`:
1. *"The company commits X% of its audited yearly net profit to holders of its dvdnd token."*
2. *"Dividends are paid in USDC on Stellar, [period], to tokens locked for the full period, pro-rata."*
3. *"The commitment lasts for as long as the business operates."*
4. *"If the business is sold, the obligation transfers to the buyer."*
5. *"Late payments are flagged publicly on the company's listing."*
6. *"The company holds no tokens and receives the full raise only if the minimum is reached..."*

**Six fatal courtroom defects make this text unenforceable as drafted:**

1. **Clause 3 (Perpetual duration) is void or terminable at will.**
   - **France:** [Art. 1210 Code civil](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041412) strictly prohibits perpetual commitments (*"Les engagements perpétuels sont prohibés"*); either party may terminate them at any time upon reasonable notice ([Art. 1211 C. civ.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041407)).
   - **Czech Republic:** Under **§ 1999(1) Act No. 89/2012 Coll.** ([Civil Code](https://www.e-sbirka.cz/sb/2012/89)), an indefinite continuing obligation may be terminated on notice, and an obligation binding a party for more than 10 years without serious reason may be cancelled by a court upon material change of circumstances.
   - **Germany:** Continuing obligations (*Dauerschuldverhältnisse*) remain subject to mandatory extraordinary termination for good cause ([§ 314 BGB](https://www.gesetze-im-internet.de/bgb/__314.html)).
   - **Required fix:** Set a **fixed maturity** (e.g., 10–25 years) with an explicit **issuer buyout/call option formula** (or use a statutory undated subordinated security where expressly permitted, e.g., French [Art. L228-97 C. com.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329704) TSDI with liquidation redemption).

2. **Clause 4 (Binding a future buyer) violates privity of contract.**
   - A contract binds only its signatories and **cannot transfer a debt to a non-signatory asset buyer**: France ([Art. 1199 C. civ.](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041378) & [Art. 1327 C. civ.](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000032032398/) — debt assignment requires creditor consent and a written act); Germany ([§ 415 BGB](https://www.gesetze-im-internet.de/bgb/__415.html)); Czechia (Civil Code § 1888); Portugal (Código Civil Arts. 406.º(2) and 595.º). In an asset sale, the buyer takes clean operating assets while token holders are left suing an empty corporate shell.
   - **Required fix:** Replace Clause 4 with a **Change-of-Control & Material Asset-Disposal Covenant**: selling >50% of voting equity or substantially all operating assets either (a) requires a binding written assumption agreement signed by the acquirer and approved by the Common Representative/SPV, **or** (b) triggers an immediate **mandatory accelerated buyout payment** out of sale proceeds + Event of Default.

3. **Clause 1 ("audited yearly net profit") is too indefinite to compute a money judgment and trivial to zero out.**
   - Owner-managers of private SMEs can lawfully depress net profit to zero via inflated director salaries, related-party IP/management charges, parent loans, or discretionary reserves.
   - **Required fix:** Name the exact accounting framework (HGB / French PCG / Czech CAS / Portuguese SNC / IFRS); define `Distributable Base` with explicit **anti-leakage add-backs** (non-arm's-length related-party payments and shareholder-director pay above a contractual cap); add a **dividend stopper** (no equity dividends or shareholder loans while distributions are unpaid); mandate annual **statutory auditor certification** of the `Distributable Base`; and grant the Common Representative/SPV an **independent audit right with cost-shifting** to the SME if profit was underreported by >3%–5%.

4. **Clause 2 ("paid in USDC on Stellar") lacks a legal-tender fallback, payment deadline, default interest, and `vault` contract incorporation.**
   - Civil courts in Germany, France, Czechia, and Portugal enforce money judgments in **legal tender (EUR / CZK)**. Without a fiat conversion fallback, a USDC depeg, issuer freeze, or refusal to on-ramp creates discharge/impossibility litigation. Moreover, if the legal contract does not expressly incorporate the exact Soroban `vault` contract address and epoch-lock forfeiture rules (`ARCHITECTURE.md`), unlocked holders can sue claiming contractual entitlement regardless of on-chain lock status.
   - **Required fix:** Specify a hard annual payment date (e.g., 30 days after annual accounts approval, outer backstop June 30), statutory commercial default interest anchored to [Directive 2011/7/EU](https://eur-lex.europa.eu/eli/dir/2011/7/oj), exact Soroban `vault` contract ID and epoch-lock rules, and an **automatic EUR/CZK fiat fallback** payable to the Common Representative/SPV bank account if on-chain USDC settlement fails or defaults.

5. **No proof of valid corporate execution, creditor standing, or collective representation.**
   - An on-chain hash + Stellar key signature proves text integrity, **not** that a registered statutory director (*Geschäftsführer* / *Président* / *Jednatel* / *Gerente*) validly bound the company in legally required form. Under **eIDAS** ([Regulation (EU) No 910/2014, Art. 25(2)](https://eur-lex.europa.eu/eli/reg/2014/910/oj)), only a **Qualified Electronic Signature (QES)** carries EU-wide equivalence to a handwritten signature.
   - Courts cannot issue judgments to anonymous public keys (`G...`). Without a single **Common Representative** (German [§ 7 SchVG](https://www.gesetze-im-internet.de/schvg/__7.html) *gemeinsamer Vertreter*; French *représentant de la masse* Art. L228-47 C. com.; Czech *společný zástupce* Bonds Act § 20a; Portuguese *representante comum* CSC Art. 357.º) or SPV holding exclusive litigation standing—or a statutory register enabling holder de-anonymization—individual holders will fail on standing (*Aktivlegitimation* / *qualité à agir*).
   - **Required fix:** Require QES execution by verified managing director(s), attach certified corporate resolutions (e.g., 75% GmbH resolution / GM resolution), anchor the hash of the complete signed PDF bundle on-chain, and appoint a **Common Representative** (or SPV) with exclusive enforcement standing.

6. **Missing governing law, jurisdiction/arbitration, insolvency ranking, and enforcement accelerator.**
   - Expressly choose governing law under **Rome I** ([Regulation (EC) No 593/2008, Art. 3](https://eur-lex.europa.eu/eli/reg/2008/593/oj)) and exclusive jurisdiction under **Brussels I bis** ([Regulation (EU) No 1215/2012, Art. 25](https://eur-lex.europa.eu/eli/reg/2012/1215/oj)) (or institutional arbitration for B2B/SPV contracts), noting that mandatory consumer protections cannot be waived for EU retail buyers under Rome I Art. 6(2) and Brussels I bis Arts. 17–19.
   - State insolvency ranking explicitly (§ 38 vs. § 39(2) InsO; Art. L228-97 C. com.; § 34 Bonds Act / § 172 Czech InsO; Art. 48 CIRE).
   - **Optional enforcement shortcut for quantified sums:** In Germany ([§ 794 Abs. 1 Nr. 5 ZPO](https://www.gesetze-im-internet.de/zpo/__794.html)) and Czechia (Notarial Code, Act No. 358/1992 Coll., § 71b), a notarial deed submitting to immediate execution (*vollstreckbare Urkunde* / *notářský zápis se svolením k přímé vykonatelnosti*) lets the creditor/SPV execute directly against SME assets once an auditor certifies a due amount or a fixed buyout triggers, bypassing multi-year merits litigation.

### 4.2 Minimum 10-Point Enforceability Checklist

Every live `dvdnd` issuance document must specify:
1. **Named statutory instrument, corporate identity (register ID / LEI), attached shareholder/board resolution, and QES execution.**
2. **Fixed maturity + explicit issuer buyout/call formula** (no perpetual commitment).
3. **Accounting standard + `Distributable Base` formula + anti-leakage add-backs + dividend stopper.**
4. **Hard annual reporting deadline + auditor certification + independent audit right with cost-shifting.**
5. **Hard payment date + Soroban `vault` ID & epoch-lock incorporation + EUR/CZK fiat fallback + statutory default interest.**
6. **Change-of-control & material asset-sale covenant** (written acquirer assumption or mandatory accelerated buyout).
7. **Statutory DLT register / transfer-mechanics clause** (eWpG / DEEP / Luxembourg DLT control agent) and off-chain holder identification rule.
8. **Common Representative / *masse* / SPV exclusive litigation standing + qualified-majority amendment mechanics** ([§ 5 SchVG](https://www.gesetze-im-internet.de/schvg/__5.html) 75% majority; French Art. L228-65 C. com. two-thirds majority).
9. **Events of Default** (non-payment past cure period, failure to audit/report, unauthorized asset disposal, insolvency) and acceleration/liquidated-damages remedies.
10. **Explicit insolvency ranking / subordination, Rome I governing law, and Brussels I bis court or arbitration forum.**

---

## 5. Primary Sources Index

- **Germany:**
  - AktG § 221: https://www.gesetze-im-internet.de/aktg/__221.html
  - HGB §§ 230, 233, 236: https://www.gesetze-im-internet.de/hgb/__230.html ; https://www.gesetze-im-internet.de/hgb/__233.html ; https://www.gesetze-im-internet.de/hgb/__236.html
  - BGB §§ 314, 398, 404, 407, 415, 488, 793: https://www.gesetze-im-internet.de/bgb/__314.html ; https://www.gesetze-im-internet.de/bgb/__398.html ; https://www.gesetze-im-internet.de/bgb/__404.html ; https://www.gesetze-im-internet.de/bgb/__407.html ; https://www.gesetze-im-internet.de/bgb/__415.html ; https://www.gesetze-im-internet.de/bgb/__488.html ; https://www.gesetze-im-internet.de/bgb/__793.html
  - eWpG §§ 1, 4, 16, 17, 24, 25, 26: https://www.gesetze-im-internet.de/ewpg/__1.html ; https://www.gesetze-im-internet.de/ewpg/__4.html ; https://www.gesetze-im-internet.de/ewpg/__16.html ; https://www.gesetze-im-internet.de/ewpg/__17.html ; https://www.gesetze-im-internet.de/ewpg/__24.html ; https://www.gesetze-im-internet.de/ewpg/__25.html ; https://www.gesetze-im-internet.de/ewpg/__26.html
  - BaFin Merkblatt 03/2023 (Kryptowertpapierregisterführung): https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Merkblatt/mb_231114_tatbestand_kryptowertpapierregisterfuehrung.html
  - InsO §§ 38, 39: https://www.gesetze-im-internet.de/inso/__38.html ; https://www.gesetze-im-internet.de/inso/__39.html
  - KWG § 1: https://www.gesetze-im-internet.de/kredwg/__1.html
  - VermAnlG § 1: https://www.gesetze-im-internet.de/vermanlg/__1.html
  - SchVG §§ 5, 7: https://www.gesetze-im-internet.de/schvg/__5.html ; https://www.gesetze-im-internet.de/schvg/__7.html
  - GmbHG § 53: https://www.gesetze-im-internet.de/gmbhg/__53.html
  - KStG § 8: https://www.gesetze-im-internet.de/kstg_1977/__8.html ; BFH 14.08.2019, I R 44/17: https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE202010104/
  - ZPO § 794: https://www.gesetze-im-internet.de/zpo/__794.html
- **France:**
  - Code de commerce Arts. L228-36, L228-37 (titres participatifs): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049720044 ; https://www.legifrance.gouv.fr/codes/id/LEGISCTA000029328075
  - Code de commerce Arts. L228-38 to L228-45, L228-97 (obligations & subordinated securities): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329647 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000034799356 ; https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000005634379/LEGISCTA000006161285/ ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029329704
  - Code monétaire et financier Arts. L211-3, L211-17 (DEEP / DLT, as updated by Ordonnance n° 2024-936): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367135 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367110
  - Code monétaire et financier Arts. L313-13 to L313-20 (prêts participatifs): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042915235 ; https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006194057
  - Code civil Arts. 1199, 1210–1215, 1321–1327, 1871–1873: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041378 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041412 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041407 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042021 ; https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000032032400/ ; https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000032032398/ ; https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006136392
- **Czech Republic:**
  - Civil Code (Act No. 89/2012 Coll.): https://www.e-sbirka.cz/sb/2012/89
  - Business Corporations Act (Act No. 90/2012 Coll., ZOK): https://www.e-sbirka.cz/sb/2012/90
  - Bonds Act (Act No. 190/2004 Coll.): https://www.e-sbirka.cz/sb/2004/190
  - Capital Market Undertakings Act (Act No. 256/2004 Coll., ZPKT): https://www.e-sbirka.cz/sb/2004/256
  - Insolvency Act (Act No. 182/2006 Coll.): https://www.e-sbirka.cz/sb/2006/182 (CNB insolvency ranking guidance: https://www.cnb.cz/en/resolution/general-approach-of-the-czech-national-bank-to-setting-a-minimum-requirement-for-own-funds-and-eligible-liabilities-mrel/standardised-method-of-reporting-insolvency-rankings/)
- **Portugal:**
  - Decreto-Lei n.º 231/81 (associação em participação): https://diariodarepublica.pt/dr/detalhe/decreto-lei/231-1981-579479
  - Decreto-Lei n.º 321/85 (títulos de participação): https://diariodarepublica.pt/dr/detalhe/decreto-lei/321-1985-180193
  - Código das Sociedades Comerciais (Decreto-Lei n.º 262/86): https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1986-34443975
  - Decreto-Lei n.º 160/87 (Lda bond issuance): https://diariodarepublica.pt/dr/detalhe/decreto-lei/160-1987-666356
  - Decreto-Lei n.º 66/2023 (DLT amendments to CVM): https://diariodarepublica.pt/dr/detalhe/decreto-lei/66-2023-216771968
  - Código da Insolvência e da Recuperação de Empresas (CIRE, Decreto-Lei n.º 53/2004): https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2004-34529075
- **Luxembourg & European Union:**
  - Luxembourg Law of 22 March 2004 on Securitisation (consolidated 2024): https://legilux.public.lu/eli/etat/leg/loi/2004/03/22/n1/consolide/20240722 ; Amending Law of 25 February 2022: https://legilux.public.lu/eli/etat/leg/loi/2022/02/25/a84/jo
  - Luxembourg Law of 20 December 2024 (DLT dematerialised securities & *agent de contrôle*): https://legilux.public.lu/eli/etat/leg/loi/2024/12/20/a597/jo
  - Regulation (EU) 2022/858 (DLT Pilot Regime): https://eur-lex.europa.eu/eli/reg/2022/858/oj
  - Regulation (EU) 2017/1129 (Prospectus Regulation): https://eur-lex.europa.eu/eli/reg/2017/1129/oj
  - Regulation (EU) No 910/2014 (eIDAS): https://eur-lex.europa.eu/eli/reg/2014/910/oj
  - Regulation (EC) No 593/2008 (Rome I): https://eur-lex.europa.eu/eli/reg/2008/593/oj
  - Regulation (EU) No 1215/2012 (Brussels I bis): https://eur-lex.europa.eu/eli/reg/2012/1215/oj
  - Council Directive (EU) 2016/1164 (ATAD): https://eur-lex.europa.eu/eli/dir/2016/1164/oj
  - Directive 2011/7/EU (Late Payment): https://eur-lex.europa.eu/eli/dir/2011/7/oj

---

## What This Means for dvdnd

`dvdnd` should **not** attempt to launch simultaneously across all four legal systems using the current `agreement.ts` text and a raw Stellar asset. Doing so leaves secondary transfers legally void in France, exposes holders to debtor-discharge and set-off risks in Germany/Czechia/Portugal, and renders the core agreement unenforceable on duration, business sale, and profit calculation.

**Concrete two-phase recommendation:**

1. **Phase 1 (First live EU jurisdiction): Launch in Germany using eWpG bearer *Genussscheine* (or France using DEEP *obligations*).**
   - **Germany is the stronger first choice:** Any GmbH or AG can issue bearer *Genussscheine* (unlike French *titres participatifs* or Portuguese *títulos de participação*); profit-only *Genussscheine* (without liquidation-proceeds participation) preserve **corporate tax deductibility** at the SME level ([§ 8 Abs. 3 Satz 2 KStG](https://www.gesetze-im-internet.de/kstg_1977/__8.html)); bearer securitisation avoids both the VermAnlG retail regime and the KWG banking-licence trap; and [§§ 16, 25–26 eWpG](https://www.gesetze-im-internet.de/ewpg/__25.html) give true on-chain legal transfer and good-faith acquisition.
   - **Operational requirement:** Partner with a **BaFin-licensed crypto securities registrar** (*Kryptowertpapierregisterführer*) to serve as the raise's `compliance` account / legal register operator, and appoint an independent **SchVG Common Representative** (*gemeinsamer Vertreter*) per raise.
   - **France as alternative first market:** Target established French SAS/SA companies (≥ 2 approved annual balance sheets to satisfy [Art. L228-39 C. com.](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000005634379/LEGISCTA000006161285/) without an auditor verification report) issuing profit-linked *obligations* registered in a compliant DEEP ([Art. L211-3 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367135); [Art. L211-17 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050367110)).

2. **Phase 2 (Czechia, Portugal, and pan-EU scaling): Use an independent Luxembourg Multi-Compartment Securitisation SPV — never one SPV per SME.**
   - Integrate an independent, regulated third-party Luxembourg securitisation platform operating a compartmentalised *société de titrisation* ([Law of 22 March 2004, Arts. 5, 62](https://legilux.public.lu/eli/etat/leg/loi/2004/03/22/n1/consolide/20240722)) with a DLT *agent de contrôle* ([Law of 20 December 2024](https://legilux.public.lu/eli/etat/leg/loi/2024/12/20/a597/jo)).
   - Each Czech, Portuguese, German, or French SME enters one simple bilateral domestic contract (*dluhopis*/loan, *obrigação*/*associação em participação*, *partiarisches Darlehen*) with its dedicated ring-fenced compartment; the compartment issues uniform Stellar DLT notes to investors and enforces audit/payment rights centrally.

3. **Immediate architecture & repo changes before mainnet:**
   - **Retire `app/src/lib/agreement.ts` for production raises** in favor of jurisdiction-specific bond/issuance schedules implementing the 10-point enforceability checklist, executed via **eIDAS QES** by verified managing directors (anchoring the SHA-256 of the QES-signed PDF + shareholder resolution in `registry`).
   - **Adjust the Didit privacy-erasure rule (`ARCHITECTURE.md`):** Keep ZK residence proofs for public-ledger privacy, **but** retain an encrypted off-chain wallet-to-identity mapping inside the raise's **licensed registrar / compliance account**. Permanently erasing holder identities breaks German eWpG (§ 17), French DEEP (Art. R211-9-7 CMF), Luxembourg control-agent reporting (Law of 20 Dec 2024), courtroom standing, and withholding-tax compliance.

---

## Questions for Counsel

1. **Zero-principal profit stream vs. statutory bond definitions:** If `dvdnd` tokens promise *only* X% of future profit with **zero principal repayment**, do they still qualify as bearer *Inhaberschuldverschreibungen* under German § 793 BGB / §§ 1, 17 Abs. 1 Nr. 3 eWpG (which requires a *Nennbetrag*), French *obligations* under Art. L228-38 C. com., Czech *dluhopisy* under § 2(1) Act No. 190/2004 Coll., and Portuguese *obrigações* under Art. 360 CSC—or must every instrument carry a nominal repayable principal at a fixed maturity (e.g., €1 or 100% nominal par)?
2. **Off-chain identity mapping + on-chain ZK proof:** Does storing holder identities exclusively off-chain at a BaFin-licensed eWpG registrar (§ 17 eWpG), French DEEP operator (Art. R211-9-7 CMF), or Luxembourg *agent de contrôle* (Law of 20 Dec 2024)—while the public Stellar ledger sees only ZK-authorized wallet addresses—satisfy both securities-register law and GDPR data minimization (Issue #24)?
3. **Germany — GmbH resolution & KWG carve-out:** Does issuing a bearer eWpG *Genussschein* (profit-only, no liquidation share, deductible under § 8(3) s. 2 KStG) by a German GmbH always require a 75% shareholder resolution by analogy to § 221 AktG, and does bearer securitisation under eWpG fully avoid KWG § 1(1) Nr. 1 deposit-taking without requiring a *qualifizierter Rangrücktritt*?
4. **France — DEEP secondary trading & *masse* mechanics:** Can unlisted French *obligations* recorded on Stellar as a DEEP (Art. L211-3 CMF) trade on Stellar's SDEX order book without triggering EU MTF / DLT Pilot Regime licensing (Issues #18 and #21), and can statutory *masse* voting (Art. L228-46 C. com.) be conducted validly via on-chain signed messages?
5. **Czech Republic — Profit-linked *dluhopis* recharacterisation risk:** Can a Czech *s.r.o.* issue a *dluhopis* (Act No. 190/2004 Coll. § 16) with a nominal principal and 100% profit-linked yield to a Luxembourg SPV compartment without tax or corporate recharacterisation as disguised equity or an unauthorized silent partnership (avoiding ZOK § 190(2)(j) / § 421(2)(o) invalidity and interest-deduction disallowance)?
6. **Portugal — Private *obrigação* vs. *associação em participação* for an SPV leg:** For a Portuguese *Lda* contracting bilaterally with a Luxembourg SPV compartment, how do the CSC Art. 349 equity cap and CIRC Art. 67 EBITDA deductibility cap compare against an *associação em participação* (DL 231/81, with written loss-exclusion under Art. 23(2)) on net after-tax investor yield and insolvency recovery?
7. **Consumer-law override on cross-border retail holders:** Where non-professional EU residents acquire tokens on primary or secondary markets, how do Rome I Art. 6(2) and Brussels I bis Arts. 17–19 constrain enforcing a single governing law, English-language terms, and exclusive issuer-seat forum?
8. **Software-only perimeter with a third-party Luxembourg SPV:** If an independent Luxembourg securitisation provider operates the multi-compartment vehicle and `dvdnd` receives only a flat software listing fee (no percentage commission, no investor custody), does `dvdnd` remain outside MiFID II placement/RTO (Issue #21) and Luxembourg CSSF authorisation (Art. 19 Securitisation Law)?
