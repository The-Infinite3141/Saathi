import os
from datetime import datetime, timezone
from flask import Flask, jsonify, render_template, request
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()
OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "weather_key_configured": bool(OPENWEATHER_API_KEY)})


@app.get("/api/weather")
def weather():
    city = (request.args.get("city") or "").strip()
    if not city:
        return jsonify({"error": "Please provide a city name, e.g. /api/weather?city=Delhi"}), 400
    if not OPENWEATHER_API_KEY:
        return jsonify({
            "error": "OpenWeather API key is not configured. Add OPENWEATHER_API_KEY to your local .env file and restart Flask."
        }), 503

    try:
        current_resp = requests.get(
            f"{OPENWEATHER_BASE}/weather",
            params={"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"},
            timeout=10,
        )
        if current_resp.status_code == 401:
            return jsonify({"error": "OpenWeather rejected the API key. Check it in .env; a newly created key may take time to activate."}), 502
        if current_resp.status_code == 404:
            return jsonify({"error": f"Location '{city}' was not found. Try a nearby larger town."}), 404
        current_resp.raise_for_status()
        current_data = current_resp.json()

        forecast_resp = requests.get(
            f"{OPENWEATHER_BASE}/forecast",
            params={
                "lat": current_data["coord"]["lat"],
                "lon": current_data["coord"]["lon"],
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
                "cnt": 8,  # 3-hour steps, approximately next 24 hours
            },
            timeout=10,
        )
        forecast_resp.raise_for_status()
        forecast_data = forecast_resp.json()

        rain_1h = (current_data.get("rain") or {}).get("1h", 0) or 0
        forecast_rain = sum(
            (item.get("rain") or {}).get("3h", 0) or 0
            for item in forecast_data.get("list", [])
        )
        current = {
            "temp": current_data["main"]["temp"],
            "feels_like": current_data["main"].get("feels_like"),
            "humidity": current_data["main"]["humidity"],
            "description": current_data.get("weather", [{}])[0].get("description", "Current conditions").capitalize(),
            "icon": current_data.get("weather", [{}])[0].get("icon", ""),
            "icon_emoji": _weather_emoji(current_data.get("weather", [{}])[0].get("icon", "")),
            "wind_speed_kmh": round((current_data.get("wind", {}).get("speed", 0) or 0) * 3.6, 1),
            "observed_at": datetime.fromtimestamp(
                current_data.get("dt", datetime.now(timezone.utc).timestamp()), timezone.utc
            ).strftime("%H:%M UTC"),
        }
        return jsonify({
            "location": {
                "name": current_data.get("name", city),
                "country": current_data.get("sys", {}).get("country", ""),
                "state": "",
                "latitude": current_data.get("coord", {}).get("lat"),
                "longitude": current_data.get("coord", {}).get("lon"),
            },
            "current": current,
            "rain_1h_mm": round(float(rain_1h), 2),
            "rain_next_24h_mm": round(float(forecast_rain), 2),
            "forecast_note": "Forecast rainfall is estimated from the next eight 3-hour forecast periods; it is not a field measurement.",
            "source": "OpenWeather",
        })
    except requests.Timeout:
        return jsonify({"error": "Weather service timed out. Please try again."}), 504
    except requests.RequestException:
        app.logger.exception("OpenWeather request failed")
        return jsonify({"error": "Could not reach OpenWeather. Check your internet connection and API plan."}), 502
    except (KeyError, ValueError, TypeError):
        app.logger.exception("Unexpected OpenWeather response")
        return jsonify({"error": "The weather provider returned an unexpected response."}), 502


def _weather_emoji(icon_code):
    if not icon_code:
        return "🌦️"
    prefix = icon_code[:2]
    return {
        "01": "☀️", "02": "🌤️", "03": "⛅", "04": "☁️",
        "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️",
    }.get(prefix, "🌦️")


@app.post("/api/ask-ai")
def ask_ai():
    if not ai_client:
        return jsonify({"error": "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file."}), 503

    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()

    if not query:
        return jsonify({"error": "Please enter a question."}), 400

    models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.8-flash"]
    last_error = ""

    config = types.GenerateContentConfig(
        system_instruction=(
            "You are Saathi AI, an intelligent smart agriculture assistant. "
            "Provide practical, concise, and scientifically grounded agricultural advice "
            "for farmers, covering crops, disease control, soil management, and weather precautions."
        ),
        temperature=0.3
    )

    for model_name in models_to_try:
        try:
            response = ai_client.models.generate_content(
                model=model_name,
                contents=query,
                config=config
            )
            return jsonify({"answer": response.text})
        except Exception as e:
            last_error = str(e)
            continue  # If 503 or 404 occurs, instantly try the next model in the list

    return jsonify({"error": f"AI service busy across all endpoints: {last_error}"}), 500

if __name__ == "__main__":
    # Local exhibition/demo server only. Do not use Flask's debug server for public deployment.
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
