# Earth Hazard Tracker v1.10 — Accurate Sidereal Transit Compass + Unique Colors

## Main correction

The Zodiacal Compass no longer uses low-precision mean-motion approximations for the planets.

A new Vercel endpoint:

`/api/ephemeris`

uses Astronomy Engine 2.1.19 to calculate geocentric positions for:

- Sun
- Moon
- Mercury
- Venus
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune
- Pluto

The geocentric equatorial vectors are converted to true ecliptic-of-date coordinates and then converted to sidereal longitude using Lahiri ayanamsa.

Rahu is the mean ascending lunar node.
Ketu is exactly 180° opposite Rahu.

## What "current transits" means

When the Zodiacal Compass is on NOW, it requests an ephemeris for the current UTC timestamp.

The forward/backward buttons request a fresh ephemeris for that selected date/time.

Planetary transit longitude is geocentric and does not depend on the map origin.

ASC/DSC do depend on:
- selected date/time
- compass origin latitude
- compass origin longitude

## Unique zodiac colors

Every sign now has its own color:
- Aries — red
- Taurus — green
- Gemini — gold
- Cancer — light blue
- Leo — orange
- Virgo — soft green
- Libra — lavender
- Scorpio — crimson
- Sagittarius — violet
- Capricorn — slate
- Aquarius — cyan
- Pisces — blue-gray

The sign boundary and sign label use the corresponding sign color.

## Unique planet colors

Every planet/node also has a unique color:
- Sun — gold
- Moon — white
- Mercury — teal
- Venus — pink
- Mars — red
- Jupiter — amber
- Saturn — gray
- Uranus — cyan
- Neptune — blue
- Pluto — purple
- Rahu — green
- Ketu — rose

Planet direction rays, map labels, and the transit list use the same consistent color.

## Precision note

Astronomy Engine documents roughly arcminute-class accuracy for supported planetary positions. The sidereal conversion uses this project's Lahiri ayanamsa implementation. Small differences may remain versus Swiss Ephemeris depending on ayanamsa implementation, apparent/true longitude conventions, and lunar node choice.

## Deployment

Upload all files from this package.

Important new file:

`api/ephemeris.js`

The updated `package.json` contains:

`"astronomy-engine": "2.1.19"`

Vercel should install this automatically.

No API key is required.
