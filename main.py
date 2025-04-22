from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # Add this import
from pydantic import BaseModel
import numpy as np
import joblib
import requests

app = FastAPI()

# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained model file (adjust filename as needed)
model = joblib.load("crime_model.pkl")

# ========== INPUT SCHEMAS ==========
class CrimeInput(BaseModel):
    lat: float
    lon: float
    hour: int       # 0-23
    weekday: int    # 0=Monday, 6=Sunday

class ChatInput(BaseModel):
    message: str

# ========== CRIME PREDICTION ROUTE ==========
@app.post("/predict")
def predict(data: CrimeInput):
    sin_hour = np.sin(2 * np.pi * data.hour / 24)
    cos_hour = np.cos(2 * np.pi * data.hour / 24)
    sin_weekday = np.sin(2 * np.pi * data.weekday / 7)
    cos_weekday = np.cos(2 * np.pi * data.weekday / 7)

    test_point = [[data.lat, data.lon, sin_hour, cos_hour, sin_weekday, cos_weekday]]
    prediction = model.predict_proba(test_point)
    crime_prob = prediction[:, 1][0] * 100

    return {"crime_probability": f"{crime_prob:.2f}%"}

# ========== CHATBOT ROUTE VIA OLLAMA ==========
@app.post("/chat")
def chat(data: ChatInput):
    ollama_url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama2",  # or "mistral", depending on what you downloaded
        "prompt": data.message,
        "stream": False  # Make sure we get a complete response, not a stream
    }
    try:
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        
        # Debug the response
        response_text = response.text
        print(f"Raw Ollama response: {response_text}")
        
        # Try to parse the response
        response_json = response.json()
        
        # Handle different response formats based on Ollama version
        if "response" in response_json:
            return {"response": response_json["response"]}
        elif "completion" in response_json:
            return {"response": response_json["completion"]}
        else:
            # If we can't find the expected fields, return the full response for debugging
            return {"response": f"Unexpected response format from Ollama: {response_json}"}
            
    except Exception as e:
        print(f"Exception details: {e}")
        return {"response": f"Error talking to Ollama: {str(e)}"}
