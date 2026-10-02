# 農場導覽獨立晝夜示範 — 2026-10-01

## Authority and record

Will, 2026-10-01: "the two scenario animated state model has to be separated. The 農場導覽 should play its own simulation too, if not easiest is day/night". His 2026-09-29 direction was 「這是兩個模擬，你要把蟲害跟巡田分開啊，他本來就不應該一個panel」 and "simplify the UX not adding more".

This dated mock-data choice was made by the Claude Code lane on 2026-10-01 under the Director mandate in `AGENTS.md`; it is not a claim that the farm team supplied observed sunrise, weather or field conditions. Recorded by the Claude Code lane under the Director mandate; the farm team (dragon5285, AskaYu800304, kevin70504) may supersede. A later dated decision replaces this choice while this file remains historical evidence.

## Choice

- Simulated date: **2026-10-01** in **Asia/Taipei** (UTC+08:00), fixed independently of the device clock.
- Site point for the presentation sun: **22.6229° N, 120.5991° E**. It is a declared approximate farm site coordinate for this mock, not a sensor position.
- Start: **00:00**. Bake **24 frames**, one per local hour, from 00:00 through 23:00. Each frame lasts **25 seconds** on the existing **600-second demonstration clock**: one simulated day equals ten demo minutes.
- Preset hints: 00:00–05:00 and 19:00–23:00 `night`; 06:00 `dawn`; 07:00–17:00 `day`; 18:00 `dusk`. These whole-hour names are presentation choices, not calculated sunrise or sunset observations.
- Each frame carries its local time, geometric solar elevation and clockwise-from-north azimuth. Bake them from NOAA Global Monitoring Division's [General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF): fractional year, equation of time, declination, true solar time, hour angle and zenith. Use the local UTC offset +8, geometric elevation without atmospheric refraction, and round angle outputs to four decimal places. The candidate records this method and the input/decision receipts.

The guide changes environment presentation only. Its frames contain no pest or patrol state, severity colour, pest notification, route, restriction or response. The existing four-beat candidate and its receipts stay on disk unchanged. Patrol retains only its separately authored patrol statuses; pest retains its spread. All three remain explicitly simulated, provenance-visible, and unsuitable for diagnosis or farm operations.
