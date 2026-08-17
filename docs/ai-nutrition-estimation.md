# AI nutrition estimation

Opt-in, server-only, non-medical calorie and macro **estimates** from a plain-language food description.

**Do not select or integrate a paid AI provider until the product owner approves the provider and expected cost.** Food-photo analysis is out of MVP.

## 1. Product rules

- AI is opt-in **per entry**. Default is manual logging.
- Send only the food description and necessary context (locale, unit system). **Do not** send HRV, sleep, weight history, activities, or other health data.
- Calls run only on the server.
- Credentials live in server-only environment variables.
- Domain model talks to a **provider port**, not a vendor SDK type.
- Return estimated energy and macros, assumptions, confidence, and a range when possible.
- Label the UI as an estimate, not a fact.
- Never persist the estimate until the user reviews and confirms.
- The user can edit every number.
- Store provenance: `manual` | `ai_estimated` | `ai_estimated_edited`.
- Vague portions → state assumptions (“assuming two large eggs ≈ 100 g”) rather than fake precision.
- Rate limit, timeout, structured-output validation (Zod), cost caps.
- Copy must not present estimates as medical or nutritional advice.

## 2. Provider port

```ts
// Implemented in Phase 4 as a port. Default provider is `disabled`.
// Paid openai/anthropic adapters are not shipped.

export type NutritionEstimateInput = {
  description: string;
  locale: string;
  massUnit: "kg" | "lb"; // display context only
};

export type NutritionEstimate = {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  assumptions: string[];
  confidence: "low" | "medium" | "high";
  energyKcalRange: { min: number; max: number };
  provider: string;
  model: string;
};

export interface NutritionEstimator {
  estimate(input: NutritionEstimateInput): Promise<NutritionEstimate>;
}
```

Implementations:

| Id                             | When                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| `disabled`                     | Default until approval. UI button disabled with explanation.           |
| `stub`                         | Tests and local demo; deterministic fixtures. Clearly labelled sample. |
| `openai` / `anthropic` / other | Only after written approval of vendor + cost                           |

The domain never imports vendor packages outside `lib/ai/providers/*`.

## 3. Server flow

1. Authenticated Server Action receives `{ description, locale }`.
2. Zod: description 1–2000 chars, no file uploads.
3. Rate limit per `user_id` (default: 10 requests / hour, 30 / day). Stored in `ai_estimation_requests` counts or a small `ai_rate_limits` table.
4. Cost guard: reject if estimated tokens would exceed a daily budget (default **$0** until a provider is approved — i.e. hard off).
5. Timeout: **8 s** client-facing; abort the provider call.
6. Provider returns JSON. Validate with Zod. On failure, user-visible “Kunde inte uppskatta; fyll i manuellt”.
7. Insert `ai_estimation_requests` as the user (see schema). Return the estimate to the client.
8. User edits and saves `nutrition_entries`. If numbers differ from the estimate, `provenance = ai_estimated_edited`.

## 4. Prompt constraints (when a provider exists)

- System prompt: estimate only; list assumptions; never claim lab accuracy; never ask for extra health data.
- User message: description + locale only.
- Structured output JSON matching `NutritionEstimate`.
- Temperature low (e.g. 0) for repeatability.

Do not use Nhost Graphite / AI Toolkit add-ons without approval (billable).

## 5. Cost envelope (decision required)

Until approval, expected cost is **$0**.

When proposing a vendor in Phase 4, the implementation plan must include:

- Model name
- Typical tokens per request
- Price per 1M tokens (verify current vendor pricing that day)
- Expected requests per active user per week
- Hard daily cap and what the user sees when hit
- Data-retention policy of the vendor (zero retention if available)

Do not enable billing-on-first-use.

## 6. Security

- No `NEXT_PUBLIC_` AI keys.
- Do not log full prompts in production if they contain enough to reconstruct diet patterns beyond what `ai_estimation_requests` already stores; the description is already stored for the owner.
- Authorization: user A cannot read B's estimation rows.
- The user can spoof their **own** macros; they cannot write rows for another user.

## 7. UX copy (Swedish product, English keys)

Show near results:

> Detta är en uppskattning baserad på din beskrivning, inte en laboratoriemätning eller kostråd.

If portions are vague, list assumptions as bullets.
