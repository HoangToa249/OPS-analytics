# ✅ Testing Checklist - Analytics Improvements

## Test Data Requirements
- Import flight data with mixed gate/stand/belt utilizations
- Include flights with duration > 60 minutes
- Include multiple flights per gate/stand in same hour
- Include flights spanning multiple hours

---

## 🧪 Unit Tests

### Gate Analytics
- [ ] Gate utilization % = (totalMinUsed / 1440) * 100
- [ ] Hourly occupancy sums correctly across 24 hours
- [ ] Long flights (>60 min) distributed to next hour
- [ ] Conflict detection finds overlapping time slots
- [ ] Peak hour = hour with most flights

**Test with:** 
- Flight 08:00-09:30 (90 min, spans 2 hours)
- Flight 08:45-09:15 (30 min, overlap with above)

---

### Stand Analytics
- [ ] Paired flights (arrStand === depStand) occupy from STA to STD
- [ ] Separate stands (arrStand ≠ depStand) calculate correctly
- [ ] Stand utilization % = (totalMinUsed / 1440) * 100 (same as Gate)
- [ ] Turnaround time = gap between consecutive flights
- [ ] Stand type determined correctly (arr/dep/mixed)

**Test with:**
- Paired: Stand A with STA 08:00, STD 09:30
- Arrival-only: Stand B with ATA 08:00, ATD 09:30
- Departure-only: Stand C with STD 08:00, ATD 09:30

---

### Belt Analytics
- [ ] Total passengers summed correctly
- [ ] Throughput = (totalPax / utilizationMin) * 60
- [ ] Utilization % = (utilizationMin / 1440) * 100
- [ ] Peak hour = hour with most passengers (not flights)
- [ ] Hourly distribution shows passenger counts by hour

**Test with:**
- Belt A: 500 pax in 2 hours = 150 pax/hr
- Belt B: 1000 pax in 5 hours = 120 pax/hr
- Verify Belt A shows higher throughput despite same pax count

---

## 📊 Visual Tests

### GateAnalytics
- [ ] Heatmap shows 15 gates (not 10)
- [ ] Heatmap colors represent intensity (blue scale)
- [ ] Long flights show data in 2+ hours
- [ ] Utilization bar chart shows color coding:
  - Green: < 50%
  - Yellow: 50-70%
  - Red: > 70%
- [ ] Hourly trend line visible and smooth
- [ ] Conflict count shows on scatter chart

### BeltAnalytics
- [ ] KPI cards display at top with correct values
- [ ] Throughput ranking sorted (highest first)
- [ ] Pie chart shows passenger distribution
- [ ] Peak hours cards show top 5 by passengers
- [ ] Statistics table shows all belts with color-coded utilization

### StandAnalytics
- [ ] KPI cards show utilization %, turnaround time
- [ ] Type distribution shows percentage split
- [ ] Turnaround chart sorted best-first
- [ ] Heatmap shows 8 stands (not 5)
- [ ] Statistics table shows conflict indicators (red for conflicts)
- [ ] Stand type badges colored correctly (Blue/Red/Green)

---

## 🔍 Integration Tests

### Multi-Hour Distribution
```
Test: Flight from 14:30 to 16:15 (105 minutes)
Expected:
- Hour 14: 30 minutes
- Hour 15: 60 minutes  
- Hour 16: 15 minutes
- Total: 105 minutes ✓
```

### Utilization Comparison
```
Test: Compare Gate vs Stand vs Belt utilization %
Expected: All three should be on same scale
- Gate 1: 45%
- Stand 1: 45% (should be comparable)
- Belt 1: 45% (should be comparable)
```

### Conflict Detection
```
Test: Two flights at same gate 14:00-15:00 and 14:45-15:45
Expected:
- Conflict detected ✓
- Count = 1 ✓
- Hourly metrics[14].gateConflicts += 1 ✓
```

### Peak Hour Accuracy
```
Gate Test:
- Hour 10: 5 flights
- Hour 11: 3 flights
- Hour 12: 7 flights
Expected: Peak hour = 12 ✓

Belt Test:
- Hour 10: 200 pax, 10 flights
- Hour 11: 150 pax, 5 flights
- Hour 12: 300 pax, 2 flights
Expected: Peak hour = 12 (based on pax, not flights) ✓
```

---

## 🎯 Real-world Scenarios

### Scenario 1: Busy Hour
- Multiple stands/gates in same hour
- Some have conflicts, some don't
- Verify heatmap shows accurate distribution

### Scenario 2: Long Occupancy
- Aircraft parked 3+ hours
- Verify occupancy splits across all hours correctly

### Scenario 3: Mixed Operations
- Arrival stands, departure stands, mixed stands
- Verify each type calculates correctly
- Verify turnaround time accurate

### Scenario 4: Low vs High Throughput Belts
- Belt A: 100 flights, 10K passengers = 100 pax/hr
- Belt B: 10 flights, 5K passengers = 500 pax/hr
- Verify throughput ranking correct

---

## ✨ Performance Tests

- [ ] Analytics calculation < 2 seconds for 1000 flights
- [ ] Charts render smoothly with large datasets
- [ ] No memory leaks when switching tabs
- [ ] Responsive design works on mobile

---

## 📋 Regression Tests

- [ ] Existing reports still work
- [ ] CSV exports show correct data
- [ ] PDF generation includes new charts
- [ ] Filters still work correctly
- [ ] Date range selection works

---

## ✅ Sign-off Checklist

- [ ] All unit tests pass
- [ ] All visual tests pass
- [ ] All integration tests pass
- [ ] All real-world scenarios tested
- [ ] Performance acceptable
- [ ] No regressions found
- [ ] Documentation updated
- [ ] Ready for production ✨

---

**Tested By:** _______________  
**Date:** _______________  
**Status:** ☐ Ready ☐ Needs Work ☐ Failed

---

## Quick Test Command

If using test framework:
```bash
npm test -- --testPathPattern=infraAnalytics
```

---

## Notes & Observations

_Space for testing notes:_

```
[Notes here]
```
