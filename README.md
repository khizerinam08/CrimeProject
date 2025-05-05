# CrimeProject

A crime prediction application with chat interface and MongoDB backend for chat history.

## Project Structure

- **Frontend**: React-based web application with chat interface
- **Backend**: Node.js and Express API with MongoDB for chat history storage
- **Python**: Crime prediction model and analysis

## Setup and Running

### Backend (Chat History)

1. Navigate to the backend directory
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with MongoDB connection details:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/chat-history
   NODE_ENV=development
   ```
4. Start the backend server:
   ```
   npm run dev
   ```

### Frontend

1. Navigate to the Frontend/frontend directory
2. Install dependencies:
   ```
   npm install
   ```
3. Start the frontend development server:
   ```
   npm run dev
   ```

### Python Backend

1. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```
2. Start the Python backend:
   ```
   python main.py
   ```

## Features

- Crime prediction based on location, time, and day
- Interactive chat interface
- Chat history saved to MongoDB
- Visualization of crime predictions