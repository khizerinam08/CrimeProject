from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import joblib
import requests
import re

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

# ========== HELPER FUNCTIONS ==========
def extract_crime_features(message):
    """Extract location, time, and day features from a message."""
    lower_text = message.lower()
    
    # Check if this is a crime-related query
    is_crime_query = 'crime' in lower_text and ('at' in lower_text or 'in' in lower_text)
    if not is_crime_query:
        return None
    
    # Parse location from message
    lat = 41.88  # Default Chicago coordinates
    lon = -87.63
    
    coords_match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', message)
    if coords_match:
        lat = float(coords_match.group(1))
        lon = float(coords_match.group(2))
    
    # Parse time (hour) from message
    hour = np.datetime64('now').astype('datetime64[h]').astype(int) % 24  # Default to current hour
    
    time_match = re.search(r'(\d+)(?::(\d+))?\s*(am|pm)', lower_text)
    if time_match:
        hour_value = int(time_match.group(1))
        ampm = time_match.group(3)
        
        # Convert to 24-hour format
        if ampm == 'pm' and hour_value < 12:
            hour_value += 12
        elif ampm == 'am' and hour_value == 12:
            hour_value = 0
        
        hour = hour_value
    
    # Parse weekday from message
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    now = np.datetime64('now')
    weekday = (now.astype('datetime64[D]').astype(int) + 4) % 7  # Convert to 0=Monday format
    
    # Check if a day of week is mentioned
    for i, day in enumerate(days):
        if day in lower_text:
            weekday = i  # 0=Monday in our model
            break
    
    return {
        "lat": lat,
        "lon": lon,
        "hour": hour,
        "weekday": weekday
    }

def get_crime_prediction(features):
    """Get crime prediction probability using the model."""
    sin_hour = np.sin(2 * np.pi * features["hour"] / 24)
    cos_hour = np.cos(2 * np.pi * features["hour"] / 24)
    sin_weekday = np.sin(2 * np.pi * features["weekday"] / 7)
    cos_weekday = np.cos(2 * np.pi * features["weekday"] / 7)
    
    test_point = [[features["lat"], features["lon"], sin_hour, cos_hour, sin_weekday, cos_weekday]]
    prediction = model.predict_proba(test_point)
    crime_prob = prediction[:, 1][0] * 100
    
    return f"{crime_prob:.2f}%"

# ========== CHATBOT ROUTE VIA OLLAMA ==========
@app.post("/chat")
def chat(data: ChatInput):
    # First, check if this is a crime-related query
    crime_features = {
    "lat": 41.76931,
    "lon": -87.66719,
    "hour": 12,
    "weekday": 0
}
    
    ollama_url = "http://localhost:11434/api/generate"
    
    if crime_features:
        # Get crime prediction
        crime_probability = get_crime_prediction(crime_features)
        
        # Create a context-aware prompt for Ollama
        context = f"""
        The user asked: "{data.message}"
        
        According to our crime prediction model, there is a {crime_probability} chance of a crime occurring at coordinates 
        {crime_features['lat']}, {crime_features['lon']} at {crime_features['hour']}:00 
        on day {crime_features['weekday']} (0=Monday, 6=Sunday).
        
        Please provide a helpful and informative response about the crime risk. Include the {crime_probability} figure in your response.
        """
        
        payload = {
            "model": "llama2",
            "prompt": context,
            "stream": False
        }
    else:
        # Regular chat, just pass the message
        payload = {
            "model": "llama2",
            "prompt": data.message,
            "stream": False
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
