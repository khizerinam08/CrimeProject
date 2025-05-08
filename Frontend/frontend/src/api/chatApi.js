import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Chat API functions
export const chatApi = {
  // Get all chats (for future multi-chat support)
  getAllChats: async () => {
    try {
      const response = await api.get('/chats');
      return response.data;
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
  },

  // Get a chat by ID
  getChatById: async (chatId) => {
    try {
      const response = await api.get(`/chats/${chatId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching chat ${chatId}:`, error);
      throw error;
    }
  },

  // Create a new chat
  createChat: async (title = 'New Chat', sessionId = null) => {
    try {
      const response = await api.post('/chats', { title, sessionId });
      return response.data;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  },

  // Add a message to a chat
  addMessage: async (chatId, message) => {
    try {
      const response = await api.put(`/chats/${chatId}/messages`, message);
      return response.data;
    } catch (error) {
      console.error(`Error adding message to chat ${chatId}:`, error);
      throw error;
    }
  },

  // Delete a chat
  deleteChat: async (chatId) => {
    try {
      const response = await api.delete(`/chats/${chatId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      throw error;
    }
  }
};

// Session-related API functions
export const createChatSession = async (title, initialMessages = []) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/sessions`, {
      title,
      initialMessages
    });
    return response.data;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

export const fetchSessions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sessions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

export const getSessionMessages = async (sessionId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/messages`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching messages for session ${sessionId}:`, error);
    throw error;
  }
};

export const updateSessionTitle = async (sessionId, title) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/sessions/${sessionId}`, { title });
    return response.data;
  } catch (error) {
    console.error('Error updating session title:', error);
    throw error;
  }
};

export const deleteSession = async (sessionId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

export const addMessageToSession = async (sessionId, message) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/sessions/${sessionId}/messages`, message);
    return response.data;
  } catch (error) {
    console.error('Error adding message to session:', error);
    throw error;
  }
};

// Prediction API functions (proxied to FastAPI)
export const getCrimePrediction = async (data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/predict`, data);
    return response.data;
  } catch (error) {
    console.error('Error getting crime prediction:', error);
    throw error;
  }
};

export const streamChatResponse = async (message, sessionId, onChunk, onDone) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/chat`, {
      message,
      session_id: sessionId,
      stream: true
    }, {
      responseType: 'stream'
    });

    return response.data;
  } catch (error) {
    console.error('Error streaming chat response:', error);
    throw error;
  }
};

export default {
  createChatSession,
  fetchSessions,
  getSessionMessages,
  updateSessionTitle,
  deleteSession,
  addMessageToSession,
  getCrimePrediction,
  streamChatResponse
}; 