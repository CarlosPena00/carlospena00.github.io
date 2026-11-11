---
layout: post
title: "Data Science: A/B Testing"
author: Carlos Pena
date: 2026-11-11
---

# Hypothesis Testing (for A/B test)

TL;DR: Assume no effect, measure how surprising your data is under that assumption, and reject the assumption only if the surprise passes a threshold you fixed in advance.

Hypothesis testing is proof by contradiction, but with probabilities:

1. H₀: Assume nothing new/interesting is happening. This assumption is the null hypothesis (H₀).
2. Work out what the data should look like if H₀ were true.
3. Look at the data you actually got and ask: "If H₀ were true, how surprising (p-value) would this be?"
4. If it would be very surprising, reject H₀. If not, you can't reject it.


**p-value** : the probability of seeing data at least this extreme if H₀ is true.
- ❌ "p = 0.017 means there's a 1.7% chance H₀ is true." It's the chance of data this extreme assuming H₀ is true, not the chance that H₀ is true.
- ❌ "Not significant means no effect." It only means the data couldn't rule out zero. The test may have lacked power.
- ❌ "Significant means it matters." A 0.01 pp lift can be significant with millions of users and still be worth nothing. Look at the effect size and its confidence interval too.
- ❌ Peeking every day and stopping as soon as p < 0.05. This inflates the false positive rate well above α.

# The running example

Throughout this post: you planned a 50/50 split between the current search ranking (A) and the new one (B). After the test you count 50,000 users in A and 51,500 in B, 101,500 in total. A perfect 50/50 split would put 50,750 in each group, so each group is 750 users off. Is that gap just chance, or is the split broken?

# Standard deviation (SD)

TL;DR: Even a perfect 50/50 split almost never lands exactly on 50,750 users per group. The standard deviation, √(n · p · (1 − p)) = √(101,500 × 0.5 × 0.5) ≈ 159 users, is how far chance alone typically pushes the B count away from 50,750: about 68% of working splits land within ±159 and 95% within ±318. It's the ruler for judging a gap: B landed 750 users away, which is 4.7 standard deviations, too far to be chance.

Variance is the average squared distance from the mean. The standard deviation is its square root:

**Variance: σ² = Σ (x<sub>i</sub> − μ)² / N**

**Standard deviation: σ = √(σ²) = √( Σ (x<sub>i</sub> − μ)² / N )**

- σ² (sigma squared): the population variance, also written Var(X). It's in squared units (users²), which is hard to interpret.
- σ (sigma): the population standard deviation. Taking the square root brings it back to the original units (users), which is why we report σ rather than σ².
- Σ: the sum over all values.
- x<sub>i</sub> ("x sub i"): the value of item number i, for i = 1, 2, …, N.
- μ (mu): the population mean (average).
- N: the total number of values in the population.

## Apply it to users

Give every user a value:
- x<sub>i</sub> = 1 if they're in B (probability p)
- x<sub>i</sub> = 0 if they're in A (probability 1 − p)

Small example with 10 users, 5 of them in B:

| x<sub>i</sub>        | 1    | 1    | 1    | 1    | 1    | 0    | 0    | 0    | 0    | 0    |
|-----------|------|------|------|------|------|------|------|------|------|------|
| x<sub>i</sub> − μ    | +0.5 | +0.5 | +0.5 | +0.5 | +0.5 | −0.5 | −0.5 | −0.5 | −0.5 | −0.5 |
| (x<sub>i</sub> − μ)² | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 |

- μ = 5 / 10 = 0.5 (the mean of 0/1 values is the share of users in B)
- Σ (x<sub>i</sub> − μ)² = 10 × 0.25 = 2.5
- σ² = 2.5 / 10 = 0.25
- σ = 0.5

General case with N users, a share p of them in B. Only two kinds of terms appear in the sum:
- N·p users have x<sub>i</sub> = 1, and each contributes (1 − p)²
- N·(1 − p) users have x<sub>i</sub> = 0, and each contributes (0 − p)² = p²

Plug those into σ² = Σ (x<sub>i</sub> − μ)² / N and simplify:

| Step | Result | What happened |
|------|--------|---------------|
| 1. Start | σ² = [ N·p·(1 − p)² + N·(1 − p)·p² ] / N | the two kinds of terms, summed and divided by N |
| 2. Cancel N | σ² = p·(1 − p)² + (1 − p)·p² | every term has an N on top, so it cancels with the N below |
| 3. Factor | σ² = p·(1 − p) · [ (1 − p) + p ] | both terms share p·(1 − p) |
| 4. Simplify | σ² = p·(1 − p) · 1 | (1 − p) + p = 1 |
| **Result** | **σ² = p·(1 − p)** | |

Check with the 10-user example (p = 0.5): σ² = 0.5 × 0.5 = 0.25 ✓

So the standard deviation of a single user is **σ = √(p·(1 − p))**. With p = 0.5, that is 0.5.

## From one user to the whole group

The number of users in B is a sum: N<sub>B</sub> = x<sub>1</sub> + x<sub>2</sub> + … + x<sub>n</sub>.

For independent values, variances add: Var(N<sub>B</sub>) = n · p · (1 − p). One user's assignment doesn't affect another's, so the values are independent.

Taking the square root gives:

**SD(N<sub>B</sub>) = √(n · p · (1 − p)) = √n · σ**

Here: √(101,500 × 0.5 × 0.5) = √25,375 ≈ **159 users**.

Watch out: these are three different standard deviations.

| Standard deviation of | What varies                              | Formula             | Value here      |
|-----------------------|------------------------------------------|---------------------|-----------------|
| One user              | a single user's value, 0 or 1            | √(p·(1 − p))        | 0.5             |
| The count N<sub>B</sub>         | how many of the n users land in B        | √n · σ              | ≈ 159 users     |
| The share N<sub>B</sub> / n     | the fraction of users in B               | σ / √n              | ≈ 0.157%        |

What "standard deviation of the count" means in practice: imagine you assign the 101,500 users with a fair 50/50 coin and write down N<sub>B</sub> (e.g. 50,812). Then you do it again (50,690), and again (50,744), thousands of times. If you apply the σ formula to that list of counts, you get μ ≈ 50,750 and σ ≈ 159. The formula n · p · (1 − p) gives you that answer without rerunning anything.

Sanity check by hand with 4 coin flips (number of heads):

| Heads (k)   | 0    | 1    | 2    | 3    | 4    |
|-------------|------|------|------|------|------|
| Probability | 1/16 | 4/16 | 6/16 | 4/16 | 1/16 |

- Mean = 2
- Variance = Σ (k − 2)² · P(k) = (4·1 + 1·4 + 0·6 + 1·4 + 4·1) / 16 = 1
- Formula: n · p · (1 − p) = 4 × 0.25 = 1 ✓

## Why it grows with √n and not n

Variance grows linearly with n, so the standard deviation only grows with √n. Over many users, deviations in opposite directions partly cancel out.

| Users (n) | SD (users) | SD as a share of n |
|-----------|------------|--------------------|
| 100       | 5          | 5%                 |
| 10,000    | 50         | 0.5%               |
| 101,500   | 159        | 0.16%              |
| 1,000,000 | 500        | 0.05%              |

In absolute numbers the noise keeps growing. As a percentage it keeps shrinking. That's why large experiments can catch small breaks in the split.

## Population vs sample (N vs n − 1)

Use the population formula (divide by N) here. p = 0.5 isn't estimated from data. It's fixed by how you designed the split, so the true mean is known. When you estimate a rate from data (e.g. a 4.0% conversion rate), the sample formula divides by n − 1 instead, but with tens of thousands of users the difference is negligible.

# The chi-squared statistic

TL;DR: χ² (chi, pronounced "kai", squared) is a single number that measures how far the observed counts are from the counts you expected. It adds up each group's squared gap, scaled by the expected count, so the result can be read against a known distribution to get a p-value. With two groups it's exactly z², the squared number of standard deviations.

## The formula

**σ² = Σ (x<sub>i</sub> − μ)² / N**

**χ² = Σ (O<sub>i</sub> − E<sub>i</sub>)² / E<sub>i</sub>**

- O<sub>i</sub>: observed users in group i.
- E<sub>i</sub>: expected users in group i = planned share × total users.
- Σ: add up the term for every group.

It has the same shape as the variance formula, σ² = Σ (x<sub>i</sub> − μ)² / N: both sum squared gaps from what you'd expect. The difference is what you divide by:

| | Variance (σ²) | Chi-squared (χ²) |
|---|---|---|
| Gap | each value vs the mean: x<sub>i</sub> − μ | each group's count vs its expected count: O<sub>i</sub> − E<sub>i</sub> |
| Divided by | N, once, to get an average | E<sub>i</sub>, per group, to compare each gap to its own noise |
| Answers | "How spread out are the values?" | "Are these gaps bigger than chance allows?" |


Why divide by E<sub>i</sub>? A gap of 750 users means very different things depending on the group size:

| 50/50 split, each group 750 users off | E per group | (O − E)² | (O − E)² / E per group | χ² (2 groups) | p-value | Verdict |
|---|---|---|---|---|---|---|
| 101,500 users | 50,750 | 562,500 | 562,500 / 50,750 ≈ 11.08 | ≈ 22.17 | ≈ 0.0000025 | surprising: split is broken |
| 100,000,000 users | 50,000,000 | 562,500 | 562,500 / 50,000,000 ≈ 0.011 | ≈ 0.023 | ≈ 0.88 | nothing: pure noise |

Without dividing by E, both cases score the same 562,500 even though one is a broken split and the other is normal noise. Dividing by E separates them: χ² ≈ 22.17 vs ≈ 0.023.

The random noise in a count grows with its size (a count's variance is roughly E). Dividing by E<sub>i</sub> turns each term into "gap² relative to the noise you'd expect", the same normalization the z-score does when it divides by the standard deviation.

## The link to the z-score (2 groups)

The `z-score` is how many standard deviations the observed count is from the expected one:

**z = gap / SD = (O<sub>B</sub> − E<sub>B</sub>) / √(n · p · (1 − p))**

- O<sub>B</sub>: users observed in B
- E<sub>B</sub> = n · p: users expected in B
- n: total users
- p: planned share of users in B

With two groups and a 50/50 split (p = 0.5, so E<sub>A</sub> = E<sub>B</sub> = n/2), both groups are off by the same amount in opposite directions, so the two χ² terms are equal:

χ² = Σ (O<sub>i</sub> − E<sub>i</sub>)² / E<sub>i</sub>

χ² = 2 (O<sub>B</sub> − n/2)² / (n/2)

χ² = (O<sub>B</sub> − n/2)² / (n/4)

n/4 = n · 0.5 · 0.5 is the variance of the B count from the standard deviation section, i.e. SD². So:

**χ² = (gap / SD)² = z²**

χ² is "how many standard deviations away, squared", written in a form that extends to any number of groups.

## From χ² to a p-value

If H₀ is true, the χ² statistic follows a known curve, the chi-squared distribution. Its shape depends on the degrees of freedom:

**degrees of freedom (df) = number of groups − 1**

The "− 1" is there because the total is fixed: once you know how many users are in A, B is forced. Only one count is free to vary in a 2-group test.

With df = 1, the chi-squared distribution is literally the square of a standard normal (z²), so both views give the same p-value.

Critical values worth remembering:

| α | df = 1 (2 groups) | Equivalent z | df = 2 (3 groups) |
|---|---|---|---|
| 0.05 | 3.84 | 1.96 | 5.99 |
| 0.01 | 6.63 | 2.58 | 9.21 |
| 0.001 | 10.83 | 3.29 | 13.82 |

If χ² is above the critical value, p is below α.

### Converting χ² to a p-value

p-value = the area under the chi-squared curve to the right of your χ², i.e. the share of working splits that would produce a χ² at least this big.

<img src="{{ '/assets/images/ab-testing/chi2-df1-pvalue.svg' | relative_url }}" width="100%" alt="Chi-squared distribution with 1 degree of freedom: the curve drops close to zero after χ² ≈ 10; the shaded tail right of 3.84 is p = 0.05, and our χ² = 22.2 sits far right where the area is about 0.0000025">

| Method | How | χ² = 22.2, df = 1 |
|---|---|---|
| Chi-squared table | find where χ² falls in the df row (only gives a range) | 22.2 > 10.83, so p < 0.001 |
| Normal table (df = 1 only) | z = √χ², then p = 2 × P(Z ≥ z) | z = 4.71, p ≈ 0.0000025 |
| Software (exact) | Python: `scipy.stats.chi2.sf(22.2, df=1)`; Excel: `=CHISQ.DIST.RT(22.2, 1)` | p ≈ 0.0000025 |

- Why χ² rather than z? z compares one count with its expectation. χ² handles any number of groups at once.

# Step by step: the sample ratio mismatch (SRM) check

Back to the running example: a planned 50/50 split, with 50,000 users in A and 51,500 in B.

## 1. State the hypotheses

- H₀: users really were assigned 50/50. Any gap is just random noise.
- H₁: the assignment is not 50/50. Something in the split is broken.

## 2. Work out what H₀ predicts

There are 101,500 users in total, so a 50/50 split means 50,750 in each group.
Even a perfect split won't land exactly on 50,750. It's like flipping a coin 101,500 times.
So the real question is how much deviation counts as normal.

For a fair coin the typical deviation is the standard deviation, √(n · 0.5 · 0.5) = √(101,500 × 0.25) ≈ 159 users. Groups off by about 100–300 users would be completely normal.

## 3. Measure what you observed

Each group is 750 users away from 50,750. That's 750 / 159 ≈ 4.7 standard deviations.

The chi-squared statistic packages the same thing:
χ² = (50,000 − 50,750)² / 50,750 + (51,500 − 50,750)² / 50,750 = 11.1 + 11.1 ≈ 22.2

(With two groups, χ² is simply that 4.7 squared: 4.7² ≈ 22.2. It's the same test written two ways.)

## 4. Convert to a p-value

With 1 degree of freedom, χ² = 22.2 gives p ≈ 0.0000025. If the split were really 50/50, you would see a gap this large about once in 400,000 experiments.

## 5. Decide

Before looking at the data you choose a threshold, α (alpha). For SRM the usual choice is α = 0.001. Since 0.0000025 < 0.001, reject H₀: the split is broken.

## 6. Why "do not read the metrics"

Losing or gaining 1,500 users is rarely random. Usually one variant is dropping or adding a specific kind of user. For example, the new ranking might time out for slow devices so those users are never logged, or a bot filter might act differently in one arm. The two groups are then no longer comparable, so any difference in conversion could come from who is in each group rather than from the ranking. That's why the SRM check runs before anything else.

# The same framework on the business metric

Once the split passes, you test the metric itself using the same logic. Here's a made-up example:

| Variant         | Users  | Conversions | Rate |
|-----------------|-------:|------------:|-----:|
| A (current)     | 50,000 | 2,000       | 4.0% |
| B (new ranking) | 50,000 | 2,150       | 4.3% |

- H₀: the new ranking doesn't change conversion, so the true rates are equal.
- H₁: the rates differ.
- If H₀ is true, both groups share one rate: 4,150 / 100,000 = 4.15%. The standard error of the difference is √(0.0415 × 0.9585 × (1/50,000 + 1/50,000)) ≈ 0.126 percentage points.
- The observed difference is 0.3 pp, which is 0.3 / 0.126 ≈ z = 2.38.
- Two-sided p ≈ 0.017. It's two-sided because H₁ is "the rates differ", not "B is better": a new ranking can also hurt conversion, and we want to catch that too.
- With the usual α = 0.05, 0.017 < 0.05, so reject H₀. The lift is statistically significant.
- Effect size: the lift is 0.3 pp (4.0% → 4.3%, a 7.5% relative lift). Its 95% confidence interval is 0.3 ± 1.96 × 0.126 ≈ [0.05, 0.55] pp. The interval excludes 0, which matches p < 0.05, but it also shows the true lift could be as small as 0.05 pp. (Strictly, the interval uses each group's own rate instead of the pooled 4.15%, but here both give 0.126 pp.)

## The two ways you can be wrong

| Decision         | H₀ actually true                               | H₀ actually false                                     |
|------------------|------------------------------------------------|-------------------------------------------------------|
| You reject H₀    | Type I error (false positive), probability = α | Correct (the probability of this is the power, 1 − β) |
| You don't reject | Correct                                        | Type II error (false negative), probability = β       |

- α is the false alarm rate you accept: calling a ranking a winner when it isn't.
- Power is your chance of detecting a real effect. It grows with sample size and with effect size. That's why you calculate the sample size before starting the test.

Why SRM uses α = 0.001 and the metric uses 0.05: the SRM check runs on every experiment, often every day. A loose threshold would raise many false alarms. Real SRMs also tend to be large and show up clearly, so the strict threshold costs almost nothing.

# What usually breaks the split

When the SRM check fails, the cause is almost never bad luck. These are the usual suspects:

| Cause | What it looks like |
|-------|--------------------|
| Uneven bot filtering | Crawlers and price-scraping bots get removed from one variant more often than from the other |
| Users lost before logging | The slower ranking makes some shoppers leave before their exposure is recorded. This only causes an SRM when you count users from the exposure log |
| Broken assignment | A logged-out visitor gets a fresh ID on a later visit and lands in a different variant |
| Uneven data cleanup | A rule drops users whose search returned nothing, and one ranking produces empty results more often than the other |
| Leftovers from an earlier test | Users exposed to a previous ranking experiment are carried into this one, unevenly across variants |

To find the cause, keep assignment and exposure separate. Record which variant each user was assigned to at the moment of assignment, before anything they do can affect it. Then compare the assignment, exposure and outcome records: if the assignment counts are balanced but the exposure counts are not, the split works and the problem is in logging or filtering.

# Is your setup trustworthy? A/A checks

An A/A test gives both groups the same experience, so there's no real effect to find. Any "significant" result is a false positive by construction. That makes A/As the way to check that the whole setup behaves the way the theory says. There are two different checks, and they answer two different questions.

## End-to-end A/A: is the platform right?

Checks: assignment, logging and metric computation.

1. Regularly run real A/As through the actual assignment, logging and metric pipeline, the same path a real experiment takes.
2. Run the SRM check on the assignment counts first. If the chi-squared p-value is below 0.001, stop and fix the split before looking at anything else.
3. Run the planned test on the metric. Across many A/As, about 5% should come out significant, because that's what α = 0.05 means. Many more than that points to a problem in the pipeline.

## Re-split calibration: is the analysis right?

Checks: the statistical test and its variance estimate.

1. Take a finished A/A and keep one row per user: the user ID and their metric value.
2. Keep every user's value, but shuffle the group labels: assign users to two groups again at random, in the planned ratio. Same data, no new users.
3. Run the same test and save the p-value. Repeat about 1,000 times.
4. Look at the results:
   - About 5% of the p-values should be below 0.05. Between 3.6% and 6.4% is within chance. That range comes from the same SD formula as the SRM section: the number of false positives out of 1,000 is a count, with SD = √(1,000 × 0.05 × 0.95) ≈ 6.9. So 50 ± 2 × 6.9 gives about 36 to 64, or 3.6% to 6.4%.
   - The histogram of p-values should be flat. When H₀ is true, a p-value is equally likely to land anywhere between 0 and 1. That's why 5% fall below 0.05, 10% below 0.10, and so on. With very discrete metrics (few conversions) the histogram can look a bit lumpy without anything being wrong.

What a failure looks like: you randomize by user but analyze per session. Sessions from the same user aren't independent, so the "variances add" step from the standard deviation section no longer holds. The standard error comes out too small, and instead of 5% you might see 10–15% of re-splits come out significant. The p-value histogram piles up near 0.

## Why you need both

Re-splitting can't find platform bugs. Errors in assignment, logging or metric definitions are already baked into the data you're reshuffling, so only an end-to-end A/A can catch them. The other way around, an end-to-end A/A needs many real runs to show that the false positive rate is off, while a re-split can check the analysis in minutes on data you already have.

# Putting it together: reading a real result

Here are sample results from a search ranking test with a planned 50/50 split. Each rate is a share of all users assigned to that variant, the lift is relative (B vs A), and the 95% confidence interval is for the lift:

| Step     | A       | Rate A | B       | Rate B | Lift   | 95% CI          |
|----------|--------:|-------:|--------:|-------:|-------:|-----------------|
| View     | 533,474 | 98.17% | 541,922 | 98.10% | −0.07% | −0.14% to −0.01% |
| Click    | 234,271 | 43.11% | 237,819 | 43.05% | −0.14% | −0.8% to +0.5%   |

Two questions, in this order: are the results valid, and only then, do they matter?

## Are they valid? Run the SRM check first

The table doesn't show the group sizes, but you can get them back from the rates: 533,474 / 0.9817 ≈ 543,419 users in A and 541,922 / 0.9810 ≈ 552,418 in B. That's 1,095,837 users in total, so a 50/50 split expects 547,918 in each group.

- Gap: B has about 4,500 more users than expected, and A about 4,500 fewer.
- SD of the B count: √(1,095,837 × 0.5 × 0.5) ≈ 523 users.
- z = 4,500 / 523 ≈ 8.6 standard deviations, so χ² ≈ 8.6² ≈ 74 and p ≈ 10⁻¹⁷.

That's far below the SRM threshold of 0.001. **The split is broken, so the metrics shouldn't be read.** B ended up with 50.4% of the users instead of 50%. That looks like a tiny difference, but with a million users it's roughly 9 standard deviations, and chance alone almost never does that.

The data also hints at where to look. B has more users but a lower view rate (98.10% vs 98.17%). That fits extra users landing in B who never really use search: bots that were filtered unevenly, or logged-out visitors who got a new ID and were reassigned (see "What usually breaks the split"). Comparing the assignment counts with the exposure counts would show which one it is.

## Would they be relevant if the split were fine?

Suppose the SRM check had passed. Here is what each step would say:

- **View: significant, but tiny.** The interval excludes 0 (p ≈ 0.007), but a 0.07% relative drop is less than one view in a thousand users. It's also the metric most likely to be affected by the extra users in B, so here it is more likely a symptom of the SRM than an effect of the ranking.
- **Click: no effect detected.** The interval goes from −0.8% to +0.5% and includes 0 (p ≈ 0.53).
- **Purchase: inconclusive.** The +0.35% is noise (p ≈ 0.74), and the interval runs from about −3.6% to +4.5%. This is the metric the business cares about, and the data is consistent with a ranking that loses 3% of purchases as well as one that gains 4%. As the p-value section warned, "not significant" doesn't mean "no effect". It means this test couldn't tell.

Why the purchase result is so vague: purchases are rare (about 3.2% of users), and rare events are noisy. With about 550,000 users per group, the smallest relative change in purchases this test could reliably detect (80% power, α = 0.05) is about 3%. Detecting a 1% change, which is already worth a lot for a search ranking, would need about 4.8 million users per group. This is why sample size has to be planned before the test starts.

Also keep in mind that this table shows three metrics. Each test at α = 0.05 has its own 5% chance of a false positive, so the more metrics you look at, the more likely one of them looks "significant" by luck. Decide which metric is the primary one before the test starts. Here it should be purchase.

## Verdict

| Question | Answer |
|----------|--------|
| Valid? | No. SRM with p ≈ 10⁻¹⁷: find and fix the cause before trusting any number in the table |
| Relevant? | Not yet. Purchase is inconclusive, with an interval from about −3.6% to +4.5% |
| Next step | Fix the split, check it with an A/A, then rerun with a sample size planned for the smallest purchase lift that's worth shipping |

