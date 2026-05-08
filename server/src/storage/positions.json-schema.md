# positions.json schema (B18)

`~/.intelistock/positions.json` holds open buy-rationales with optional sell
triggers. Single-user, single-portfolio for now.

```json
{
  "rationales": [
    {
      "id": "p-abcd1234",
      "symbol": "NVDA",
      "reason": "Bottoming out after correction; FY26 capex guidance unchanged",
      "entryPrice": 196.76,
      "createdAt": 1778100000000,
      "triggers": [
        { "type": "date",            "date": "2026-09-01" },
        { "type": "absoluteAbove",   "price": 250.00 },
        { "type": "absoluteBelow",   "price": 170.00 },
        { "type": "pctFromBase",     "basePrice": 196.76, "pct": 20 },
        { "type": "trailingFromPeak","pct": -10, "peakPrice": 196.76 }
      ],
      "firedAt": null,
      "firedTrigger": null,
      "notified": false
    }
  ]
}
```

* `pct` is signed. `+20` = 20% above base; `-10` = 10% below peak (trailing).
* `peakPrice` is bumped on each evaluator pass for `trailingFromPeak`.
* `firedAt` stays null until any trigger matches; once set, the rationale is
  considered closed and subsequent passes ignore it.
