# Melbourne Glow

Predicts how likely today's sunrise and sunset in Melbourne are to light up the clouds.
Vanilla HTML/CSS/JS — no build step.

- Sunrise/sunset times: [SunCalc](https://github.com/mourner/suncalc) (vendored in `src/vendor/`)
- Weather: [Open-Meteo](https://open-meteo.com/) hourly cloud cover, visibility and humidity
- Scoring heuristic: `src/score.js`

## Run locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 (or `http://<your-mac-ip>:8000` from an iPad on the same network).

## Deploying

Pushing to `main` publishes to GitHub Pages. Run `./scripts/bump-version.sh` before committing
CSS/JS changes so browsers and the iPad home-screen app pick up the new files instead of cached ones.
