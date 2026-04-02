# JPL Horizons API — Research Notes

## Overview

NASA's JPL Horizons system provides ephemeris data (positions, velocities) for solar system bodies and spacecraft. It is the authoritative source for solar system body positions.

## API Endpoint

```
https://ssd.jpl.nasa.gov/api/horizons.api
```

- Method: GET or POST
- Format: Returns JSON with `result` (text blob) and `signature` fields
- No authentication required
- No API key needed
- CORS supported (works directly from browser `fetch()`)
- No practical rate limits detected (tested 20 rapid sequential requests, all returned 200)

## Key Parameters

| Parameter | Purpose | Example Values |
|-----------|---------|----------------|
| `COMMAND` | Target body ID | `'10'` Sun, `'199'` Mercury, `'299'` Venus, `'399'` Earth, `'301'` Moon, `'499'` Mars, `'599'` Jupiter, `'699'` Saturn, `'799'` Uranus, `'899'` Neptune, `'-1024'` Artemis II |
| `EPHEM_TYPE` | Output type | `'VECTORS'` for cartesian x/y/z |
| `CENTER` | Origin/reference body | `'500@10'` Sun-centered, `'500@399'` Earth-centered |
| `VEC_TABLE` | Data columns | `'2'` = position + velocity |
| `REF_PLANE` | Reference plane | `'ECLIPTIC'` = ecliptic J2000 |
| `REF_SYSTEM` | Reference system | `'ICRF'` |
| `OUT_UNITS` | Units | `'KM-S'` or `'AU-D'` |
| `STEP_SIZE` | Time resolution | `'1m'`, `'1h'`, `'1d'` |
| `START_TIME` | Start of range | `'2026-04-02 00:00'` |
| `STOP_TIME` | End of range | `'2026-04-02 12:00'` |
| `OBJ_DATA` | Include body metadata | `'NO'` to skip |
| `format` | Response format | `json` |

## Body IDs (Complete Solar System)

### Major Bodies
- `10` — Sun
- `199` — Mercury
- `299` — Venus
- `399` — Earth
- `499` — Mars
- `599` — Jupiter
- `699` — Saturn
- `799` — Uranus
- `899` — Neptune

### Key Moons
- `301` — Moon (Earth)
- `401` — Phobos (Mars)
- `402` — Deimos (Mars)
- `501` — Io (Jupiter)
- `502` — Europa (Jupiter)
- `503` — Ganymede (Jupiter)
- `504` — Callisto (Jupiter)
- `601` — Mimas (Saturn)
- `602` — Enceladus (Saturn)
- `603` — Tethys (Saturn)
- `604` — Dione (Saturn)
- `605` — Rhea (Saturn)
- `606` — Titan (Saturn)
- `701` — Ariel (Uranus)
- `702` — Umbriel (Uranus)
- `703` — Titania (Uranus)
- `704` — Oberon (Uranus)
- `801` — Triton (Neptune)

### Spacecraft
- `-1024` — Artemis II (Orion/Integrity)

## Example API Call

Sun-centered position of Earth, every hour for 12 hours:

```
https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='399'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@10'&START_TIME='2026-04-02 00:00'&STOP_TIME='2026-04-02 12:00'&STEP_SIZE='1h'&VEC_TABLE='2'&REF_PLANE='ECLIPTIC'&OUT_UNITS='KM-S'
```

## Response Format

The response is JSON with a `result` field containing a large text string. The actual data is between `$$SOE` (Start Of Ephemeris) and `$$EOE` (End Of Ephemeris) markers.

Each data point looks like:

```
2460769.500000000 = A.D. 2025-Mar-15 00:00:00.0000 TDB
 X =-1.462755060417386E+08 Y =-3.105106656526134E+07 Z = 1.601359619813040E+03
 VX= 3.890998568251733E+00 VY=-3.309122891500192E+01 VZ=-3.317480185780646E-01
```

- X, Y, Z in km (heliocentric ecliptic J2000)
- VX, VY, VZ in km/s (velocity components)
- Julian Date + Calendar Date at the start

## Parsing

Data must be parsed from the text block using regex or string splitting:
1. Find text between `$$SOE` and `$$EOE`
2. Split into blocks (each has date line + position line + velocity line)
3. Extract X, Y, Z values (and optionally VX, VY, VZ)

Example regex pattern for position values:
```javascript
/X\s*=\s*([-\dE.+]+)\s*Y\s*=\s*([-\dE.+]+)\s*Z\s*=\s*([-\dE.+]+)/
```

The artemis2-live project has working parsing code for reference.

## Coordinate System

For a heliocentric 3D solar system view:
- `CENTER='500@10'` — Sun at origin
- `REF_PLANE='ECLIPTIC'` — Ecliptic plane of J2000
- `OUT_UNITS='KM-S'` — Kilometers
- All bodies share the same coordinate frame — positions are directly comparable

For Three.js: divide km values by a scale factor. 1 AU = 149,597,870.7 km.

## Real-Time Capabilities

- Horizons provides **current and future** positions, not just historical
- Can request `START_TIME='now'` for the current moment
- Planetary positions are based on long-term ephemeris solutions (DE441) — extremely accurate
- Spacecraft positions are based on navigation solutions, updated hours after trajectory changes
- Resolution up to 1-minute intervals

## Rate Limits & Reliability

- No detected rate limits
- No authentication
- Server may be slower during high-traffic events
- Recommended: cache responses, don't poll more than every 15-30 minutes
- Optional `EMAIL_ADDR` parameter for JPL to contact you in case of issues

## Artemis II Specific

- Object ID: `-1024`
- Trajectory coverage: 2026-Apr-02 01:59 through 2026-Apr-11 00:02 TDB
- No data before ICPS separation (~3.5h after launch)
- No data after entry interface
- Navigation data from NASA/JSC, updated multiple times during mission
- Underlying data has 4-minute intervals, API can interpolate to 1-minute

## Batch Requests

To get multiple bodies efficiently, make parallel requests (one per body). There is no single endpoint that returns multiple bodies at once.

Example: to get the full solar system at current time, make 9 parallel requests:
- Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune

Each returns a few KB of data — total bandwidth is minimal.

## Implementation Strategy for Real-Time Solar System

1. On page load: fetch current positions of all bodies from Horizons (parallel requests)
2. Also fetch positions for +1 hour ahead (2 data points per body)
3. Interpolate between the two data points based on wall clock time for smooth animation
4. Every 30 minutes: re-fetch from Horizons to get updated positions
5. Use `CENTER='500@10'` (Sun-centered) for all bodies so coordinates are in the same frame
6. Scale from km to Three.js units (e.g., 1 unit = 1 Earth radius, or 1 unit = N km)

## Sources

- API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Horizons web interface: https://ssd.jpl.nasa.gov/horizons/
- Body ID reference: https://ssd.jpl.nasa.gov/horizons/app.html (look up bodies)
- artemis2-live project: https://github.com/JOnathanST29/artemis2-live
- Artemis AROW tracker: https://www.nasa.gov/missions/artemis-ii/arow/
