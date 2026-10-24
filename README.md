# Saathi — AI Smart Agriculture (Flask version)

A local Class XII science-exhibition prototype with a dashboard, two Teachable Machine model slots, webcam/image upload, OpenWeather data through a Python Flask backend, and rule-based crop/irrigation advice.

## Security first
The OpenWeather key was pasted into chat. Treat it as exposed: revoke/regenerate it in your OpenWeather account, then place the replacement only in your local `.env` file. Do not paste it into HTML/JavaScript or commit `.env` to source control. The code does not contain the key.

## Setup (Windows)
1. Install Python 3.10+.
2. Extract this folder.
3. Open Command Prompt or PowerShell in this folder.
4. Create a virtual environment:
   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   If PowerShell blocks activation, use Command Prompt and run `.venv\Scripts\activate.bat`.
5. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
6. Copy `.env.example` to a new file named `.env`, then replace the placeholder with your **new** OpenWeather key:
   ```text
   OPENWEATHER_API_KEY=your_new_key_here
   ```
7. Start the app:
   ```powershell
   python app.py
   ```
8. Open `http://127.0.0.1:5000` in Chrome. Use this localhost address for webcam permission.

## Dashboard features
- Dashboard overview and recent session activity
- Crop leaf image upload and webcam capture
- Two-stage Teachable Machine classification (Model 2 runs only when Model 1 returns the configured unhealthy class with confidence at least 70%)
- Current weather and approximate next-24-hour rain total via Flask backend
- Crop advisory and simulated soil-moisture irrigation advisor

## Trained models
The Model Setup fields are pre-filled with the supplied URLs:
- Health check (Model 1): `https://teachablemachine.withgoogle.com/models/wtHi_ADSE/`
- Disease classes (Model 2): `https://teachablemachine.withgoogle.com/models/oaObDgYx_/`

Check the exact healthy/unhealthy class names shown in Model 1 and adjust those fields if needed. The models are loaded in the browser through the Teachable Machine JavaScript library. The model URLs are not sent to Flask.

## Notes
- Weather needs internet and an active OpenWeather API key. New keys can take a little while to activate.
- OpenWeather's free-plan availability and request limits depend on your account and current plan.
- The rain forecast sums the next eight 3-hour forecast periods, so it is approximate.
- Crop and irrigation advice are transparent demo rules, not trained AI or guaranteed agricultural recommendations.
- Plant model predictions are not diagnoses; verify disease/treatment decisions with a local agricultural expert.
