import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Chat History API functions
export const chatHistoryApi = {
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