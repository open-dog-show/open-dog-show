# Research: language & website-integration options for ADR-0004

**Issue:** #10 · **Status:** research note (input to ADR-0004) · **Date:** 2026-08-01

## Intro

ADR-0004 (tech stack) narrowed the language/runtime choice to three candidates — **TypeScript/Node**, **.NET/C#**, and **PHP (Symfony + Doctrine)** — but could not close because two goals lacked evidence: (1) easiest self-install/hosting for small clubs, and (2) integration with a club's existing website/CMS. A design fork also surfaced: **Model A** (standalone app + embeddable JS widgets + HTTP API + webhooks, CMS-agnostic) vs **Model B** (ships as a WordPress/CMS plugin, in-process).

This note investigates both goals against primary sources and takes a position. It respects the ADR-0003 clean-room policy: capabilities are described in original words and every claim is cited to the source that owns it. Where evidence is thin or inferred, that is stated explicitly.

---

## Q1 — How do small clubs / hobbyist non-profits run their web presence today?

**What the primary data shows.** W3Techs' content-management survey reports that WordPress is used by **41.2% of all websites**, giving it a **59.1% share** among sites that use a CMS the survey tracks, while **30.4% of websites use none** of the monitored content-management systems.[^w3-cms] On the server side, W3Techs reports **PHP is used by 70.6%** of websites whose server-side language is known.[^w3-lang] Because WordPress itself is PHP,[^wp-plugin] its dominance is a large part of that PHP figure.

**Interpretation for our audience.** The dominant realistic setups for a small non-profit are therefore:

- **WordPress on PHP hosting** — by far the single most common CMS footprint.[^w3-cms]
- **Hosted SaaS site builders (Wix, Squarespace, and similar)** — these appear inside the same CMS survey's tracked systems, but the fetched W3Techs summary only exposed the WordPress and "none" figures directly, so an exact percentage split for Wix/Squarespace is **not quoted here** (see *Evidence gaps*).
- **Hand-rolled / static sites and "no CMS"** — plausibly a meaningful slice of the **30.4% "none"** bucket, though that bucket also contains bespoke and non-tracked stacks, so it is not a clean proxy for "hand-rolled." (Inference.)
- **No web presence at all** — common for very small clubs; not measurable from web-technology surveys, which by construction only see sites that exist. (Inference.)

**Hosting they typically have.** Two facts anchor this: PHP's 70.6% ubiquity[^w3-lang] and WordPress's stated baseline of **PHP 8.3+, MariaDB 10.11+ / MySQL 8.0+, Apache or Nginx, and HTTPS**, explicitly noting that "any server that supports PHP and MySQL will do."[^wp-req] That is the classic **PHP + MySQL shared-hosting** profile, which is why it is so widely available and cheap. Clubs on Wix/Squarespace, by contrast, have **no server they control** — only the builder's hosted environment. (The split between shared-hosting clubs, SaaS-only clubs, and VPS-owning clubs is **not directly measured** in the sources gathered; see *Evidence gaps*.)

---

## Q2 — What can a non-technical club realistically operate for self-hosting?

Three deployment shapes, ranked by operational friction for a non-technical operator:

1. **"Install nothing, use a hosted instance."** Lowest friction: the club operates no server, no runtime, no database, no patching. This requires us to run a hosted instance (see Q4) but demands nothing of the club. (Reasoned; no external cite needed — it is the absence of infrastructure.)
2. **A single container image (Docker / Docker Compose).** Docker Compose defines a multi-service app in **one YAML file** and brings the whole stack up "with a single command," and is documented to work "in all environments — production, staging, development, testing."[^docker] This is low-friction *for someone comfortable with a command line and a VPS*, but it still presumes the club can obtain and maintain a host — a real barrier for a non-technical volunteer. (The "single command" claim is Docker's; the "non-technical barrier" is our inference.)
3. **PHP on shared hosting.** Paradoxically the most *familiar* option for clubs, because it is the WordPress deployment they may already have: the requirement is only "any server that supports PHP and MySQL."[^wp-req] But operating a bespoke PHP app (as opposed to clicking "install WordPress" in a host's panel) still means uploading code, configuring a database, and keeping PHP current — non-trivial for a non-technical user.

**Conclusion.** For a genuinely non-technical club, ranked friction is: **hosted instance ≪ shared-hosting install ≈ single Docker image**, with the two self-host options roughly tied but both clearly above "install nothing." This favours designs where self-hosting is optional rather than the primary path.

---

## Q3 — Integration patterns ranked by reach + friction

Ranked by how many club setups they cover against how much technical skill they demand:

| Pattern | Reach | Friction for non-technical club | Primary basis |
|---|---|---|---|
| **iframe embed** | Very high — works in any page that lets you paste HTML | Low | Universal HTML; oEmbed's own security note recommends rendering third-party HTML "in an `iframe`, hosted from another domain" to contain XSS.[^oembed] |
| **Embeddable JS widget** | High — any site where you can add a `<script>` tag | Low–medium (must be allowed to add script; some SaaS builders restrict this) | Widget is just JavaScript; runs wherever a page can load a script. (Inference from the web platform.) |
| **oEmbed / paste-a-URL** | High on consumers that support it (e.g. WordPress) | Very low — the user just pastes a URL | oEmbed is a standard where a consumer turns a URL into an embedded representation without parsing the resource, with discovery via `<link>` tags and `rich`/`video` response types carrying the embed HTML.[^oembed] |
| **HTTP API (JSON)** | High technically, low for non-technical clubs | High — needs a developer | Any language that can make HTTP requests and parse JSON can integrate; this is exactly how WordPress's own REST API is framed.[^wp-rest] |
| **RSS / webhooks** | Medium — good for "publish results elsewhere" | Medium | Standard feed/callback mechanisms. (No dedicated cite gathered.) |
| **Native CMS plugin (e.g. WordPress)** | High *within* that one CMS, zero outside it | Very low to install (one click), but only for that CMS | A WordPress plugin is PHP code that extends core;[^wp-plugin] a shortcode is a macro that lets a non-technical author drop dynamic content into a post without writing code.[^wp-shortcode] |

**Which combination covers the most setups?** No single mechanism wins. The **broadest coverage for the least club-side skill** is a layered stack: an **HTTP/JSON API** as the substrate, exposed to non-technical users through **embeddable JS widgets + iframe/oEmbed**, and *optionally* wrapped by a **thin native plugin** for the one CMS (WordPress) that dominates the market.[^w3-cms] The API alone covers developers; widgets/iframes/oEmbed cover WordPress *and* Wix/Squarespace/hand-rolled sites that allow embeds; the plugin adds one-click convenience for the single largest platform. A plugin *alone* (Model B) maximises convenience for WordPress users but has **zero reach** into the ~59% of sites that are not WordPress.[^w3-cms]

---

## Q4 — Does a hosted multi-tenant instance make self-hosting a "nice-to-have"?

**Reasoning.** ADR-0002 already establishes a multi-tenant **Platform Administration** context that onboards Clubs as tenants. If the project operates one hosted instance, then per Q2 the lowest-friction path for a non-technical club ("install nothing") is available *by default*, and self-hosting becomes an option exercised only by clubs with a specific reason (data sovereignty, cost control at scale, or an existing VPS). AGPL-3.0 (ADR-0003) is compatible with this: a hosted operator must publish source, but clubs using the hosted instance are unaffected.[^wp-req-not] Combined, this strongly suggests **self-hosting is a "nice-to-have," and the hosted multi-tenant instance is the primary distribution channel.**

**What would confirm or refute it.**
- *Confirm:* evidence that target clubs lack a server they control and prefer SaaS (consistent with the Wix/Squarespace segment and the "no site" segment from Q1), and that per-club hosting cost on a shared multi-tenant instance is low.
- *Refute:* a hard requirement from national kennel bodies or clubs for on-premises/self-hosted data, or unwillingness to trust a third-party operator with entries/payments. This is **not measured** in the sources here and is the key open risk. (Flagged as thin.)

---

## Q5 — Per-candidate fit for Model A (widgets + API + CMS connectors)

Model A's front end is JavaScript **regardless of backend** (widgets and embeds run in the browser). The differentiator is therefore how well each backend shares contracts with that JS front end and how cleanly it exposes a decoupled API.

- **TypeScript/Node.** TypeScript "builds on JavaScript" and compiles to JavaScript that "runs anywhere JavaScript runs: in a browser, on Node.js, Deno, Bun,"[^ts] letting the same **type definitions** (e.g. an `interface` describing an entry or a result) be authored once and shared by both the API server and the browser widgets.[^ts-shapes] This is the strongest **shared-types** story of the three, and it keeps ADR-0001's pure domain core in the same language as the UI.
- **.NET/C#.** ASP.NET Core is a cross-platform, open-source framework with **Minimal APIs** for "fast web APIs with minimal code," and it "integrates seamlessly with popular client-side frameworks… Angular, React, Vue."[^dotnet] It can also render UI in C# via **Blazor** ("no JavaScript required"),[^dotnet] but that does not remove JS from *embeddable widgets on someone else's page*, and it means the API and the browser widget speak **different languages**, so contracts must be shared via generated clients/OpenAPI rather than a single source type. Strong API story; weaker shared-types story for Model A.
- **PHP/Symfony.** Symfony is "the leading PHP framework to create websites and web applications," built from "decoupled and reusable packages,"[^symfony] and is fully capable of exposing a JSON API. Its native advantage is that it is the **same language as WordPress**, which matters for a native plugin (Q6) — but for Model A's browser widgets it has the same cross-language gap as .NET, and no shared-types story with the JS front end.

**CMS connectors.** All three can call the WordPress REST API, which is explicitly documented as callable from "PHP, Node.js, Go, and Java, to Swift, Kotlin, and beyond."[^wp-rest] A *native* WordPress plugin, however, must be **PHP**,[^wp-plugin] which is the one place PHP has a structural edge.

**Verdict for Model A:** TypeScript/Node has the best overall fit (shared types across the JS front end and backend, single-language core), with .NET a close second on raw API strength and PHP third for Model A specifically.

---

## Q6 — Cost of Model B (WordPress plugin), and is a hybrid viable?

**What Model B would concede.** A WordPress plugin is PHP code that runs **in-process inside WordPress**, extending its core.[^wp-plugin] Shipping the product *as* that plugin would:

- **Marry the framework** — directly against ADR-0001's "keep the domain core framework-agnostic and pure." The core would live inside WordPress's request lifecycle and PHP runtime.
- **Fight the multi-tenant model** — ADR-0002's Platform Administration onboards many Clubs as tenants on one instance; an in-process WordPress plugin is inherently **single-site**, one WordPress install per club, which inverts the intended topology.
- **Cap reach at WordPress** — it does nothing for the ~59% of sites that are not WordPress.[^w3-cms]

**Is a hybrid viable?** Yes, and it is the reconciling option. WordPress's REST API is designed precisely for "a standalone program in a language other than PHP" to exchange JSON over HTTP,[^wp-rest] and a plugin can present dynamic content to non-technical authors through a **shortcode** without them writing code.[^wp-shortcode] So a **thin WordPress connector plugin** that merely calls our hosted API and renders the result (via a shortcode/block or an embedded widget/iframe) preserves the pure core (ADR-0001) and the multi-tenant hosted model (ADR-0002) while still giving WordPress clubs a one-click, native-feeling install. The plugin holds **no domain logic** — it is an adapter, consistent with clean architecture.

**Verdict:** Model B as the product's shape is rejected on ADR-0001/0002 grounds; the **hybrid (Model A core + thin WordPress connector plugin)** captures most of Model B's convenience without the architectural concessions.

---

## Recommendation for ADR-0004

**Adopt Model A (standalone core + HTTP/JSON API + embeddable JS widgets + iframe/oEmbed), plus a thin WordPress connector plugin as an optional convenience (the hybrid from Q6). Reject Model B as the primary shape.**

**Language: choose TypeScript/Node for the application and API.** Rationale:

1. **The front end is JavaScript no matter what** (widgets/embeds run in the browser), and TypeScript uniquely lets one set of type contracts be shared by the browser and the server because it compiles to JS that runs in both.[^ts][^ts-shapes] .NET and PHP both force a cross-language contract boundary for Model A.
2. **Reach beats in-process convenience.** WordPress is dominant but is still a minority of *all* sites (59.1% CMS share, and 30.4% of sites use no tracked CMS),[^w3-cms] so an API-first, embed-first design covers far more club setups than a WordPress-only plugin.
3. **The hosted multi-tenant instance (ADR-0002) makes "install nothing" the default path**, demoting self-hosting to a nice-to-have and neutralising PHP-shared-hosting's main advantage; where a club *is* on WordPress, the thin PHP connector plugin — the only place PHP is structurally required[^wp-plugin] — still gives them a native experience.

**Runner-up:** .NET/C# is a strong, credible second (excellent Minimal-API and tooling story[^dotnet]); it loses to TypeScript only on the shared-types/one-language-core axis for Model A. **PHP/Symfony** is capable[^symfony] but is best justified only if Model B (WordPress-native, in-process) were chosen — which conflicts with ADR-0001/0002 — so it ranks third for the recommended architecture.

### Evidence gaps (flagged)

- **Q1 market split:** exact percentages for Wix/Squarespace and for "hand-rolled vs no site" were **not** obtained as clean first-party figures (the W3Techs summary surfaced only WordPress and "none"). The WordPress/PHP dominance is well-cited; the finer split is inferred and should be firmed up with the full W3Techs CMS breakdown and BuiltWith trends before relying on it.
- **Q1/Q2 hosting-type distribution** (shared hosting vs SaaS-only vs VPS among small clubs) is **inferred** from PHP/WordPress ubiquity, not directly measured.
- **Q4** rests on reasoning, not data: whether clubs or national kennel bodies will **require self-hosting / on-prem data** is the key unquantified risk and could partially reopen the Model A vs B question.

---

## Sources

[^w3-cms]: W3Techs — *Usage statistics and market shares of content management systems.* WordPress 41.2% of all websites, 59.1% CMS market share; 30.4% of websites use none of the monitored CMS. https://w3techs.com/technologies/overview/content_management
[^w3-lang]: W3Techs — *Usage statistics of server-side programming languages for websites.* PHP used by 70.6% of websites whose server-side language is known. https://w3techs.com/technologies/overview/programming_language
[^wp-req]: WordPress.org — *Requirements.* PHP 8.3+, MariaDB 10.11+ / MySQL 8.0+, Apache or Nginx, HTTPS; "any server that supports PHP and MySQL will do." https://wordpress.org/about/requirements/
[^wp-req-not]: WordPress.org — *Requirements* (same page); baseline hosting profile as above, underpinning the shared-hosting characterisation. https://wordpress.org/about/requirements/
[^wp-rest]: WordPress Developer Resources — *REST API Handbook.* JSON over HTTP; callable from "PHP, Node.js, Go, and Java, to Swift, Kotlin, and beyond," including "a standalone program in a language other than PHP." https://developer.wordpress.org/rest-api/
[^wp-shortcode]: WordPress Developer Resources — *Shortcodes.* Macros for dynamic content within posts without writing PHP; includes the built-in `[embed]`. https://developer.wordpress.org/plugins/shortcodes/
[^wp-plugin]: WordPress Developer Resources — *What is a Plugin?* "Plugins are packages of code that extend the core functionality of WordPress… made up of PHP code." https://developer.wordpress.org/plugins/intro/what-is-a-plugin/
[^oembed]: oEmbed specification — URL-to-embed format; discovery via `<link>`/Link headers; `rich`/`video` response types; security note recommending third-party HTML be rendered in an off-domain `iframe`. https://oembed.com/
[^docker]: Docker Docs — *Docker Compose.* Multi-container app defined in one YAML file, started "with a single command"; works "in all environments — production, staging, development, testing." https://docs.docker.com/compose/
[^symfony]: Symfony — *What is Symfony.* "The leading PHP framework to create websites and web applications," built on "decoupled and reusable packages." https://symfony.com/what-is-symfony
[^dotnet]: Microsoft Learn — *Overview of ASP.NET Core.* Cross-platform, open-source; Minimal APIs "build fast web APIs with minimal code"; integrates with Angular/React/Vue; Blazor renders UI in C# "no JavaScript required." https://learn.microsoft.com/en-us/aspnet/core/introduction-to-aspnet-core
[^ts]: TypeScript — official site. "TypeScript is JavaScript with syntax for types"; compiles to JavaScript that "runs anywhere JavaScript runs: in a browser, on Node.js, Deno, Bun." https://www.typescriptlang.org/
[^ts-shapes]: TypeScript — official site, *Describe Your Data.* `interface`/`type` describe the shape of objects and functions, enabling shared contracts. https://www.typescriptlang.org/
