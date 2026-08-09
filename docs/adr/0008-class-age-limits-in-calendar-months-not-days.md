---
status: accepted
---

# Class age limits stored in whole calendar months, not days

`ClassDefinition` age bounds (`fromAgeMonths`, `lessThanAgeMonths`) are whole calendar months, not days. `FciClassEligibilityPolicy` computes a dog's completed-month age using calendar-month arithmetic (`completedMonths(dateOfBirth, showDate)`), not a day count.

The FCI and SRSH/KMSH regulations express all age limits in whole months ("from 6 months", "less than 15 months"). Storing limits in days and converting at data-load time requires choosing how many days represent a month — but months have variable lengths (28–31 days). A dog born 2024-01-31 reaches "6 months" on 2024-07-31, but converting "6 months = 183 days" could place that boundary on a different date depending on rounding. Calendar-month arithmetic avoids this entirely by working in the same unit the rules use.
