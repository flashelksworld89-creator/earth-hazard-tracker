# Earth Hazard Tracker

A global natural-hazard and weather monitoring web app.

## Version 1 features

- Interactive MapLibre 3D globe / flat map toggle
- USGS earthquakes (up to 30 days)
- GDACS tropical cyclones, volcanoes, floods, wildfires and droughts
- Open-Meteo current weather by clicking anywhere on Earth
- Place search
- Event filtering
- 1–30 day event time window
- Live-event sidebar
- Automatic slow globe rotation
- Vercel serverless proxy for GDACS

## Data sources

- USGS Earthquake Hazards Program
- GDACS (Global Disaster Alert and Coordination System)
- Open-Meteo
- MapLibre GL JS

This app is for situational awareness and exploration. It is not an emergency warning service. Always follow official local emergency agencies and weather services.

## Deploy on Vercel

1. Upload all files and folders in this project to your GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the GitHub repository.
4. Framework preset can remain **Other**.
5. Click **Deploy**.

No API keys are required for Version 1.

## Important

The `/api/gdacs.js` function should remain in the `api` folder. It avoids browser cross-origin problems when requesting the GDACS API.
