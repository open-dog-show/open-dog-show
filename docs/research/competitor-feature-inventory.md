# Research: online dog-show platform feature inventory

Read-only competitive inventory of existing online dog-show entry/administration platforms. Facts are described in neutral, original wording; no UI text, marketing copy, or database content is reproduced. Purpose: identify differentiators for an open-source alternative and understand the online-entry/payment loop — not to clone any product.

Scope note: The **primary competitor** target could not be captured (see Confidence & gaps). Two working UK peers were inventoried in depth: **Fosse Data** and **Higham Press**. Both are established bureaux that combine software with a print/administration service.

---

## Platform: Fosse Data (Fosse Data Systems Ltd)

Operator: Fosse Data Systems Ltd, Rugby, UK. Self-described as operating in the show-services space since 1982. Positions itself as a technology-plus-service provider for shows. Public headline stats on the homepage indicate a large active base (order of ~250 shows open to enter at a time, ~1,200 shows run per year, tens of thousands of registered exhibitors).

### 1. Online-entry flow (exhibitor)
- Exhibitors browse a list of shows open for entry, plus a "closing soon" view, and open a per-show detail page before entering. [1][6]
- Entry requires a registered exhibitor account with a personal dashboard ("My Account"/"My Dashboard"); dogs are held under the account for reuse across entries. [1]
- The exhibitor selects a show, chooses classes, and pays online within the same flow; the FAQ set confirms online payment capture and entry confirmation ("how do I know my payment has been taken"). [4][5]
- Entry passes/ring numbers are issued either by email or post. [5]
- Beyond breed classes, exhibitors can add paid extras during entry (e.g. catalogue pre-order, car park / disabled car park, caravan/benching-related requests). [5]

### 2. Club-side administration
Fosse Data offers clubs a bundled, largely done-for-you service rather than pure self-service software. Advertised capabilities: [3]
- Schedule creation and printing.
- Handling exhibitor phone/email enquiries on the club's behalf.
- Promotion of the show on the operator's own high-traffic website, plus targeted marketing emails to previous entrants and owners of matching breeds.
- Catalogue compilation and printing from combined online **and** postal entries.
- On-the-day results infrastructure and results handling.
- A club-facing online portal to watch entries accumulate, with downloadable reports retained long-term.
- Supply of physical show materials: judging books, prize cards, ring numbers.
- Compilation of the results catalogue and submission of results to the national kennel club.
- A management-reporting set giving the society visibility of entries and costs.

### 3. Publishing
- Public show schedules and a "shows starting soon" list. [1]
- Public results section (recent results per society + a full results archive). [1]
- Downloadable annual show calendar. [1]
- Also supports field trials, working tests and training days as distinct event types. [1]

### 4. Pricing model
- No price list is published; clubs are directed to "list your show" / contact sales, indicating bespoke/quote-based pricing to the society for the service package. [3]
- The visible monetisation on the exhibitor side is entry fees plus optional paid add-ons (catalogue, parking, caravan). Where the cost falls between club vs. exhibitor is not stated publicly. [5]

### 5. Notable add-ons
- Marketing reach (breed-targeted emailing + a destination website with its own traffic).
- Long-term retained reporting/archive for clubs.
- Multi-discipline support (conformation shows **and** field trials/working tests/training days) in one system.

---

## Platform: Higham Press (Higham Press Ltd)

Operator: Higham Press Ltd, a family-run business established 1945, Derbyshire, UK. Primarily a printer that also runs a complete show-entry service. Its online entry system succeeded an earlier "DogBiz" (dog.biz) platform; accounts and some data were migrated, and postal-entry contacts were folded into the new online accounts. [2][7][8]

### 1. Online-entry flow (exhibitor)
- Exhibitor registers an account with verified email and an enforced strong password (rejects passwords found in known breach lists). One account manages all dogs the person owns. [7]
- Dogs are added under the account with kennel-club number validation (supports UK KC formats plus Irish and Jersey KC numbers), breeder details, and owner "partnerships." A kennel-club rule is enforced that a single entry form covers one ownership only; separate ownerships require separate entries. [7]
- Entry path: open "Upcoming Shows," pick the show, accept the KC declaration/rules, select the dog(s) sharing that ownership, tick classes, then add extras (catalogue, car park, caravan, junior-handling classes), review the entry, and "Confirm and Pay" online. [7]
- After successful payment the entry appears in the account's show-entries area; on the show's first day the status flips to "in progress," where passes and ring numbers become visible. Post-entry self-service includes changing classes and adding a dog to an existing entry. Extras can also be bought without entering a dog in classes. [7]

### 2. Club-side administration
- Marketed as a complete show service for secretaries of any size of show, from the smallest open shows to large all-breed championship shows. [2]
- Advertised elements: schedules, catalogues, show accounting, and mailing of exhibitors, backed by in-house printing (digital for short runs, lithographic for longer runs; in-house finishing/binding). [2]

### 3. Publishing
- Public results pages (including top awards such as Best in Show) and an upcoming-shows list. [2]
- Schedule downloads are provided as PDFs, along with downloadable annual show-date lists/calendars. [2]

### 4. Pricing model
- No online price list; the business is quote-based ("ask for a quote"), consistent with a print-led service model where the club is the paying customer. [2]
- Exhibitor side again shows entry fees plus optional paid extras (catalogue, parking, caravan). [7]

### 5. Notable add-ons
- Full in-house print/finishing capability tied directly to the entry data (schedules, catalogues, stationery, hardback results books).
- Hybrid postal + online entry handling merged into one catalogue/account model — useful where part of the exhibitor base is offline. [7][8]
- Show accounting bundled with entries. [2]

---

## Platform: primary competitor (target — not captured)

The named primary target could not be inventoried: every page attempt (multiple paths, http and https, with/without `www`) returned no extractable content, consistent with a client-side-rendered single-page application that the fetch tool cannot render. No factual claims are recorded for this platform to avoid guessing. See Confidence & gaps for suggested follow-up. [9]

---

## Differentiator opportunities for an open-source alternative

Derived by contrast with the two captured incumbents (both are print-led service bureaux with bespoke pricing and vendor-hosted data):

- **Self-serve show setup without a bureau.** Both incumbents position the club as a customer of a done-for-you service (schedules, catalogues, results all produced by the vendor). An open-source tool that lets a small club configure classes, schedule and entry rules itself removes the per-show service dependency. [3][2]
- **Digital-first catalogue and schedule.** Incumbent value is heavily tied to physical printing. A web/PDF catalogue, running order and schedule generated automatically (print optional) attacks the largest cost driver directly. [2][3]
- **Transparent, pass-through payments.** Neither publishes pricing. An alternative can offer a Stripe-style pass-through so the club keeps entry fees and sees a clear per-entry processing cost, versus opaque bundled fees. [3][2]
- **Club-owned, exportable data.** Incumbent reporting lives inside the vendor portal. Data ownership + open export (CSV/JSON) and no lock-in is a clear differentiator. [3]
- **Live ring/running-order updates.** Incumbents publish results after the fact; real-time ring numbers, running order and live results on mobile is an obvious gap to fill. [1][2]
- **Multi-kennel-club number support out of the box.** Higham already validates UK/Irish/Jersey KC numbers; matching or exceeding this (configurable per registry) keeps parity while enabling other national bodies. [7]
- **Hybrid online/postal without a print bureau.** Higham's strength is merging postal + online; an open tool could offer simple manual-entry capture so clubs aren't forced to outsource. [7][8]
- **Reusable exhibitor/dog profiles + partnerships/ownership rules** modelled as first-class domain concepts, since kennel-club "one ownership per entry" rules are a real constraint incumbents already encode. [7]

## Cost-pain analysis for small clubs

Based on the incumbents' service-bundle model (facts) plus reasoned inference (flagged):

- **Bundled bureau pricing scales badly for low-volume shows (inference).** Both incumbents sell an end-to-end service — schedule, catalogue printing, results, mailing, materials. Small open shows have low entry counts, so fixed service and print costs are spread over few entries, raising effective cost per entry. [3][2]
- **Print is a structural cost centre.** Catalogue and stationery printing are explicitly central to both operators. A small club pays for physical catalogues and materials even when digital would suffice. [2][3]
- **Opaque pricing.** Neither operator publishes rates, so small clubs cannot self-estimate cost and must negotiate — friction that favours larger, repeat-customer shows. [3][2]
- **Add-on fees push cost onto exhibitors (fact + inference).** Paid extras (catalogue, parking, caravan) and booking/admin fees appear at checkout; the split of who ultimately absorbs platform cost is not disclosed, but exhibitor-side fees are a visible pain point. [5][7]
- **Vendor-hosted data and portal dependency.** Reporting, entry history and results live in the vendor's system, creating switching cost and ongoing dependency that a small volunteer-run club may find hard to leave. [3]

Net: the cost pain for small clubs concentrates in (a) print-led bundled service fees that don't scale down, and (b) lack of a cheap, self-serve, digital-first option with transparent pass-through payments and portable data — which is precisely the wedge for an open-source alternative.

---

## Sources
1. Fosse Data — homepage / shows / results / calendar: https://www.fossedata.co.uk/
2. Higham Press — homepage / about / printing / show info: https://www.highampress.co.uk/ ; https://www.highampress.co.uk/page/about-higham-press ; https://www.highampress.co.uk/page/show-information
3. Fosse Data — services provided / list your show: https://www.fossedata.co.uk/Services-Provided.aspx
4. Fosse Data — FAQ index: https://www.fossedata.co.uk/FAQs/
5. Fosse Data — "Entering Shows" FAQ: https://www.fossedata.co.uk/faqs/Entering-Shows/
6. Fosse Data — shows to enter: https://www.fossedata.co.uk/shows/Shows-To-Enter.aspx
7. Higham Press — Frequently Asked Questions (entry flow, accounts, dogs, extras, payment): https://www.highampress.co.uk/page/frequently-asked-questions
8. Higham Press — postal/DogBiz migration notes (within FAQ above): https://www.highampress.co.uk/page/frequently-asked-questions
9. Primary competitor — attempted but not extractable (SPA).

## Confidence & gaps
- **High confidence:** Fosse Data and Higham Press exhibitor entry flow (browse → account → select dog/classes → add extras → confirm & pay online → passes/ring numbers), club-side service bundles, and publishing (schedules, catalogues, results). Sourced directly from each operator's own pages. [1][2][3][5][7]
- **Low/no confidence — pricing specifics:** Neither operator publishes per-entry fees, subscription rates, or the club-vs-exhibitor cost split. Statements about where cost pain concentrates are labelled inference and should be confirmed by contacting the operators or reviewing a sample club's schedule (schedules often list entry fees and any booking fee).
- **Gap — the primary competitor (the named target):** could not be captured; the site behaves like a JavaScript SPA that the fetch tool cannot render. Follow-up options: open it in the integrated browser to read the rendered DOM, retrieve it via an archive snapshot, or inspect its public JSON/API endpoints. Until then, no facts about this platform are asserted.
- **Gap — additional peers:** attempts to capture a national/US entry system with published pricing (e.g. showmanager.com, dogbiz.co.uk, showentriesonline.co.uk) also failed to extract, so a third data point with transparent pricing is still missing and would strengthen the cost-pain analysis.
- **Anti-copy note:** all descriptions are paraphrased capability facts; no interface text, screenshots, or catalogue/database content were copied. This inventory is intended to inform differentiation and a licensing/anti-copy decision.

No files were modified and no git actions were taken, per the ticket's read-only constraint.
