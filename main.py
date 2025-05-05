from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import joblib
import requests
import re
from uuid import uuid4
from langchain.memory import ConversationBufferMemory
from langchain.schema import AIMessage, HumanMessage
from fastapi.responses import StreamingResponse
import json
from fastapi import HTTPException
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

app = FastAPI()

# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize geocoder for address to coordinates conversion
geocoder = Nominatim(user_agent="crime_prediction_app")

# Load your trained model file (adjust filename as needed)
model = joblib.load("crime_model.pkl")

# Store conversation memories by session ID
conversation_memories = {}

# ========== INPUT SCHEMAS ==========
class CrimeInput(BaseModel):
    lat: float
    lon: float
    hour: int       # 0-23
    weekday: int    # 0=Monday, 6=Sunday

class ChatInput(BaseModel):
    message: str
    session_id: str = None  # Optional session ID for memory persistence
    stream: bool = True     # Whether to stream the response or not

class AddressInput(BaseModel):
    address: str

# ========== GEOCODING ENDPOINT ==========
@app.post("/geocode")
def geocode_address(data: AddressInput):
    """Convert an address string to latitude and longitude coordinates."""
    try:
        # Add "Chicago" to the query if it's not already there
        query = data.address
        if "chicago" not in query.lower() and "il" not in query.lower() and "illinois" not in query.lower():
            query += ", Chicago, IL"
        
        # Try to geocode the address
        location = geocoder.geocode(query, timeout=10)
        
        if location is None:
            return {
                "success": False,
                "error": "Could not find coordinates for the address provided. Please be more specific or try a different address."
            }
        
        # Verify the result is in Chicago area (approximate boundaries)
        chicago_bounds = {
            "lat_min": 41.6,
            "lat_max": 42.1,
            "lon_min": -87.9,
            "lon_max": -87.5
        }
        
        in_chicago = (
            chicago_bounds["lat_min"] <= location.latitude <= chicago_bounds["lat_max"] and
            chicago_bounds["lon_min"] <= location.longitude <= chicago_bounds["lon_max"]
        )
        
        if not in_chicago:
            return {
                "success": False,
                "error": "The location is outside Chicago. Please provide a location within Chicago city limits."
            }
        
        # Return the coordinates
        return {
            "success": True,
            "lat": location.latitude,
            "lon": location.longitude,
            "display_name": location.address
        }
        
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        return {
            "success": False,
            "error": f"Geocoding service error: {str(e)}. Please try again later."
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error geocoding address: {str(e)}"
        }

# ========== HELPER FUNCTIONS ==========
def extract_crime_features(message, memory=None):
    """Extract location, time, and day features from a message, using conversation context if available."""
    lower_text = message.lower()
    
    # Check if this is a crime-related query
    is_crime_query = ('crime' in lower_text or 'risk' in lower_text or 'danger' in lower_text or 'safety' in lower_text) and ('at' in lower_text or 'in' in lower_text or 'there' in lower_text)
    if not is_crime_query:
        return None
    
    # Default values
    lat = 41.88  # Default Chicago coordinates
    lon = -87.63
    hour = np.datetime64('now').astype('datetime64[h]').astype(int) % 24  # Default to current hour
    now = np.datetime64('now')
    weekday = (now.astype('datetime64[D]').astype(int) + 4) % 7  # Convert to 0=Monday format
    
    # Parse location from current message
    coords_match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', message)
    location_found = False
    
    if coords_match:
        lat = float(coords_match.group(1))
        lon = float(coords_match.group(2))
        location_found = True
    
    # Check for references to "there", "that location", etc.
    location_references = ['there', 'that location', 'that place', 'that area', 'same location', 'same place']
    has_location_reference = any(ref in lower_text for ref in location_references)
    
    # If using a reference and we have memory, try to get coordinates from history
    if has_location_reference and not location_found and memory:
        entities = extract_key_entities(memory)
        if entities["locations"]:
            # Use the most recent location mentioned
            latest_location = entities["locations"][-1]
            coords = latest_location.split(", ")
            if len(coords) == 2:
                try:
                    lat = float(coords[0])
                    lon = float(coords[1])
                    location_found = True
                except ValueError:
                    pass
    
    # Parse time (hour) from message
    time_match = re.search(r'(\d+)(?::(\d+))?\s*(am|pm)', lower_text)
    time_found = False
    
    if time_match:
        hour_value = int(time_match.group(1))
        ampm = time_match.group(3)
        
        # Convert to 24-hour format
        if ampm == 'pm' and hour_value < 12:
            hour_value += 12
        elif ampm == 'am' and hour_value == 12:
            hour_value = 0
        
        hour = hour_value
        time_found = True
    
    # Check for time references
    time_references = ['that time', 'same time', 'then']
    has_time_reference = any(ref in lower_text for ref in time_references)
    
    # If using a time reference and we have memory, get time from history
    if has_time_reference and not time_found and memory:
        entities = extract_key_entities(memory)
        if entities["times"]:
            # Use the most recent time mentioned
            latest_time = entities["times"][-1]
            time_match = re.search(r'(\d+)(?::(\d+))?\s*(am|pm)', latest_time.lower())
            if time_match:
                hour_value = int(time_match.group(1))
                ampm = time_match.group(3)
                
                # Convert to 24-hour format
                if ampm == 'pm' and hour_value < 12:
                    hour_value += 12
                elif ampm == 'am' and hour_value == 12:
                    hour_value = 0
                
                hour = hour_value
                time_found = True
    
    # Parse weekday from message
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    day_found = False
    
    # Check if a day of week is mentioned
    for i, day in enumerate(days):
        if day in lower_text:
            weekday = i  # 0=Monday in our model
            day_found = True
            break
    
    # Check for day references
    day_references = ['that day', 'same day']
    has_day_reference = any(ref in lower_text for ref in day_references)
    
    # If using a day reference and we have memory, get day from history
    if has_day_reference and not day_found and memory:
        entities = extract_key_entities(memory)
        if entities["days"]:
            # Use the most recent day mentioned
            latest_day = entities["days"][-1]
            for i, day in enumerate(days):
                if day == latest_day:
                    weekday = i
                    day_found = True
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

def is_off_topic_query(message):
    """Detect if a query is off-topic (not crime-related)"""
    lower_text = message.lower()
    
    # Check for conversation memory questions
    memory_keywords = [
        'previous message', 'last message', 'what did i', 'what i said', 
        'earlier message', 'previous prompt', 'conversation history',
        'what was my', 'remember what', 'recall what'
    ]
    
    for keyword in memory_keywords:
        if keyword in lower_text:
            return False  # Memory questions are not off-topic
    
    # List of off-topic keywords
    off_topic_keywords = [
        'weather', 'temperature', 'forecast', 
        'sports', 'game', 'score',
        'restaurant', 'food', 'recipe',
        'movie', 'show', 'entertainment'
    ]
    
    # If message contains off-topic keywords
    for keyword in off_topic_keywords:
        if keyword in lower_text:
            return True
            
    # If message doesn't contain crime-related terms
    crime_terms = ['crime', 'safety', 'risk', 'danger', 'theft', 'robbery', 'assault']
    has_crime_term = any(term in lower_text for term in crime_terms)
    
    # Query about specific location but not about crime
    location_terms = ['at', 'in', 'near', 'around', 'by']
    has_location_term = any(term in lower_text for term in location_terms)
    
    # If it has location terms but no crime terms, it might be asking about something else
    if has_location_term and not has_crime_term:
        return True
        
    return False

def is_memory_query(message):
    """Check if the query is about conversation history/memory"""
    lower_text = message.lower()
    memory_keywords = [
        'previous message', 'last message', 'what did i', 'what i said', 
        'earlier message', 'previous prompt', 'conversation history',
        'what was my', 'remember what', 'recall what'
    ]
    
    return any(keyword in lower_text for keyword in memory_keywords)

def get_memory_response(memory):
    """Generate a response about conversation history"""
    messages = memory.chat_memory.messages
    if len(messages) < 2:
        return "We haven't had much conversation yet."
    
    # Get the previous user message (before the current one)
    previous_messages = []
    for i, message in enumerate(messages[:-2]):  # Exclude current query and its response
        if isinstance(message, HumanMessage):
            previous_messages.append(f"You said: '{message.content}'")
    
    if not previous_messages:
        return "You haven't sent any messages prior to asking about conversation history."
    
    # Return just the most recent message for brevity
    return f"Your last message was: '{previous_messages[-1][10:-1]}'"

def extract_key_entities(memory):
    """Extract key entities (locations, times, etc.) from conversation history"""
    entities = {
        "locations": [],
        "times": [],
        "days": [],
        "crime_types": []
    }
    
    # Common crime types to detect
    crime_keywords = ["theft", "robbery", "assault", "burglary", "murder", "homicide", 
                      "shooting", "violence", "crime", "criminal"]
    
    for message in memory.chat_memory.messages:
        if isinstance(message, HumanMessage):
            text = message.content.lower()
            
            # Extract coordinates
            coords_match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', message.content)
            if coords_match:
                location = f"{coords_match.group(1)}, {coords_match.group(2)}"
                if location not in entities["locations"]:
                    entities["locations"].append(location)
            
            # Extract times
            time_match = re.search(r'(\d+)(?::(\d+))?\s*(am|pm)', text)
            if time_match:
                time = f"{time_match.group(0)}"
                if time not in entities["times"]:
                    entities["times"].append(time)
            
            # Extract days
            days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            for day in days:
                if day in text and day not in entities["days"]:
                    entities["days"].append(day)
            
            # Extract crime types
            for crime in crime_keywords:
                if crime in text and crime not in entities["crime_types"]:
                    entities["crime_types"].append(crime)
    
    return entities

# ========== CRIME PREDICTION ENDPOINT ==========
@app.post("/predict")
def predict_crime(data: CrimeInput):
    """Predict crime probability for a specific location, time, and day."""
    try:
        # Validate inputs - reject default coordinates or obviously invalid inputs
        default_coords = (41.88, -87.63)  # Default Chicago coordinates from frontend
        
        # Check if the coordinates are the defaults or very close to them
        is_default_location = (
            abs(data.lat - default_coords[0]) < 0.001 and 
            abs(data.lon - default_coords[1]) < 0.001
        )
        
        # Check for invalid coordinates (0,0 or extreme values)
        is_invalid_location = (
            (abs(data.lat) < 0.001 and abs(data.lon) < 0.001) or
            abs(data.lat) > 90 or 
            abs(data.lon) > 180
        )
        
        if is_default_location or is_invalid_location:
            return {
                "probability": "0.00%",
                "error": "Please select a specific location on the map before requesting a prediction."
            }
        
        # Format features for prediction
        sin_hour = np.sin(2 * np.pi * data.hour / 24)
        cos_hour = np.cos(2 * np.pi * data.hour / 24)
        sin_weekday = np.sin(2 * np.pi * data.weekday / 7)
        cos_weekday = np.cos(2 * np.pi * data.weekday / 7)
        
        # Create input point for model
        test_point = [[data.lat, data.lon, sin_hour, cos_hour, sin_weekday, cos_weekday]]
        
        # Get prediction probability
        prediction = model.predict_proba(test_point)
        crime_prob = prediction[:, 1][0] * 100
        
        # Return formatted probability
        return {"probability": f"{crime_prob:.2f}%"}
    
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")

# ========== CHATBOT ROUTE VIA OLLAMA ==========
@app.post("/chat")
def chat(data: ChatInput):
    # Create or retrieve the session ID
    session_id = data.session_id if data.session_id else str(uuid4())
    
    # Create or retrieve memory for this session
    if session_id not in conversation_memories:
        conversation_memories[session_id] = ConversationBufferMemory()
        is_first_message = True
    else:
        is_first_message = False
    
    memory = conversation_memories[session_id]
    
    # Add the user message to memory
    memory.chat_memory.add_user_message(data.message)
    
    # Check if query is about conversation memory/history
    if is_memory_query(data.message):
        response_text = get_memory_response(memory)
        memory.chat_memory.add_ai_message(response_text)
        
        # If not streaming, return a single response
        if not data.stream:
            return {"response": response_text, "session_id": session_id}
        
        # If streaming, return chunks of the response
        def generate():
            # Stream character by character to avoid word-breaking issues
            for char in response_text:
                yield json.dumps({"chunk": char, "session_id": session_id}) + "\n"
                
        return StreamingResponse(generate(), media_type="application/x-ndjson")
    
    # Check if query is off-topic
    if is_off_topic_query(data.message):
        response_text = "I'm specifically designed to provide crime risk assessments and can't answer queries about weather, sports, or other topics. Please ask me about crime risk in specific locations. For example: 'What's the crime risk at 41.88, -87.63 at 9pm on Friday?'"
        memory.chat_memory.add_ai_message(response_text)
        
        # If not streaming, return a single response
        if not data.stream:
            return {"response": response_text, "session_id": session_id}
        
        # If streaming, return chunks of the response
        def generate():
            # Stream character by character to avoid word-breaking issues
            for char in response_text:
                yield json.dumps({"chunk": char, "session_id": session_id}) + "\n"
                
        return StreamingResponse(generate(), media_type="application/x-ndjson")
    
    # Extract crime features from the user's message
    crime_features = extract_crime_features(data.message, memory)
    
    ollama_url = "http://localhost:11434/api/generate"
    
    # Retrieve conversation history
    history = ""
    if memory.chat_memory.messages:
        for message in memory.chat_memory.messages:
            if isinstance(message, HumanMessage):
                history += f"User: {message.content}\n"
            elif isinstance(message, AIMessage):
                history += f"Assistant: {message.content}\n"
    
    if crime_features:
        # Get crime prediction
        crime_probability = get_crime_prediction(crime_features)
        
        # Extract key entities from conversation history
        entities = extract_key_entities(memory)
        entity_context = ""
        if any(entities.values()):
            entity_context = "Key entities mentioned in conversation:\n"
            for category, items in entities.items():
                if items:
                    entity_context += f"- {category.capitalize()}: {', '.join(items)}\n"
        
        # Format the conversation history
        history = ""
        if memory.chat_memory.messages:
            for message in memory.chat_memory.messages:
                if isinstance(message, HumanMessage):
                    history += f"User: {message.content}\n"
                elif isinstance(message, AIMessage):
                    history += f"Assistant: {message.content}\n"
        
        # Create a context-aware prompt for Ollama with conversation history
        context = f"""
        {'You are a crime risk assistant. Introduce yourself briefly.' if is_first_message else 'Previous conversation history:'}
        {history}
        
        {entity_context}
        
        Current user message: "{data.message}"
        
        According to our crime prediction model, there is a {crime_probability} chance of a crime occurring at coordinates 
        {crime_features['lat']}, {crime_features['lon']} at {crime_features['hour']}:00 
        on day {crime_features['weekday']} (0=Monday, 6=Sunday).
        
        IMPORTANT: Maintain context across messages. Reference previous locations or times if the user is building on earlier questions.
        
        Provide a concise response (1-2 sentences) about the crime risk. Include the {crime_probability} figure.
        Keep your tone professional and direct. Avoid verbose language.
        Respond in 50 words or less. Be brief but informative and contextually relevant.
        """
        
        payload = {
            "model": "llama2",
            "prompt": context,
            "stream": data.stream,
            "max_tokens": 75  # Limit response length
        }
    else:
        # Regular chat with conversation history
        history = ""
        if memory.chat_memory.messages:
            for message in memory.chat_memory.messages:
                if isinstance(message, HumanMessage):
                    history += f"User: {message.content}\n"
                elif isinstance(message, AIMessage):
                    history += f"Assistant: {message.content}\n"
        
        # Extract key entities from conversation history
        entities = extract_key_entities(memory)
        entity_context = ""
        if any(entities.values()):
            entity_context = "Key entities mentioned in conversation:\n"
            for category, items in entities.items():
                if items:
                    entity_context += f"- {category.capitalize()}: {', '.join(items)}\n"
        
        context = f"""
        {'You are a crime risk assistant. Introduce yourself briefly in 1-2 sentences.' if is_first_message else 'Previous conversation history:'}
        {history}
        
        {entity_context}
        
        Current user message: "{data.message}"
        
        IMPORTANT: Maintain context across messages. If the user refers to locations, times, or other 
        entities mentioned in previous messages using pronouns or references like "there", "that time", 
        "those areas", etc., you should understand these refer to the specific entities mentioned before.
        
        For example, if they previously asked about "41.88, -87.63" and now ask about "there at 9pm", 
        you should understand they're still referring to coordinates 41.88, -87.63.
        
        Always keep your responses under 50 words, concise but contextually aware.
        If they're asking about crime risk but the message format wasn't recognized, 
        briefly tell them to include location information (coordinates), time, and day.
        
        IMPORTANT: You can ONLY answer questions about crime risk. If the question is about anything else (weather, sports, etc.), 
        politely explain that you can only provide information about crime risk in specific locations.
        
        Do not use emojis. Keep your tone professional and your responses brief (1-2 sentences maximum).
        """
        
        payload = {
            "model": "llama2",
            "prompt": context,
            "stream": data.stream,
            "max_tokens": 75  # Limit response length
        }
    
    try:
        # If not streaming, just get the full response
        if not data.stream:
            response = requests.post(ollama_url, json=payload)
            response.raise_for_status()
            
            # Try to parse the response
            response_json = response.json()
            
            # Get the response text
            if "response" in response_json:
                response_text = response_json["response"]
            elif "completion" in response_json:
                response_text = response_json["completion"]
            else:
                response_text = f"Unexpected response format from Ollama: {response_json}"
            
            # Update memory with AI's response
            memory.chat_memory.add_ai_message(response_text)
            
            # Return response with session ID for the client to store
            return {"response": response_text, "session_id": session_id}
        
        # If streaming, stream the response
        else:
            # Create a streaming function
            def generate():
                full_response = ""
                
                # Make the streaming request to Ollama
                with requests.post(ollama_url, json=payload, stream=True) as r:
                    for line in r.iter_lines():
                        if line:
                            # Parse the line and extract the chunk
                            json_response = json.loads(line)
                            if "response" in json_response:
                                chunk = json_response["response"]
                                full_response += chunk
                                
                                # Send character by character to avoid word-breaking issues
                                for char in chunk:
                                    yield json.dumps({"chunk": char, "session_id": session_id}) + "\n"
                
                # When done, add the full response to memory
                memory.chat_memory.add_ai_message(full_response)
            
            # Return a streaming response
            return StreamingResponse(generate(), media_type="application/x-ndjson")
            
    except Exception as e:
        print(f"Exception details: {e}")
        error_message = f"Error talking to Ollama: {str(e)}"
        
        # Add error message to memory
        memory.chat_memory.add_ai_message(error_message)
        
        # If not streaming, return error directly
        if not data.stream:
            return {"response": error_message, "session_id": session_id}
        
        # If streaming, return error as a stream
        def generate_error():
            # Stream character by character to avoid word-breaking issues
            for char in error_message:
                yield json.dumps({"chunk": char, "session_id": session_id}) + "\n"
            
        return StreamingResponse(generate_error(), media_type="application/x-ndjson")