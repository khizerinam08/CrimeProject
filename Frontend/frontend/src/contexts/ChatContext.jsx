import { createContext, useState, useContext, useEffect } from 'react';
import * as chatApi from '../api/chatApi';

// Create the context
export const ChatContext = createContext();

// Custom hook to use the chat context
export const useChatContext = () => useContext(ChatContext);

// Provider component
export const ChatProvider = ({ children }) => {
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChatSessions, setLoadingChatSessions] = useState(false);
  
  // Add location-related state that's session-specific
  const [sessionLocationState, setSessionLocationState] = useState({});

  // Load chat sessions from MongoDB
  const loadChatSessions = async () => {
    try {
      setLoadingChatSessions(true);
      const sessions = await chatApi.fetchSessions();
      
      // Sort sessions by updatedAt timestamp (newest first)
      const sortedSessions = sessions.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      
      setChatSessions(sortedSessions);
      
      // If we have sessions and no active session, activate the first one
      if (sortedSessions.length > 0 && !currentSessionId) {
        // Don't load messages yet - wait for user to click
        // setCurrentSessionId(sortedSessions[0].sessionId);
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    } finally {
      setLoadingChatSessions(false);
    }
  };

  // Generate a unique ID for messages
  const generateUniqueId = () => {
    return Date.now() + Math.floor(Math.random() * 1000);
  };

  // Load messages for a specific session
  const loadSessionMessages = async (sessionId) => {
    if (!sessionId) return;
    
    setLoading(true);
    setCurrentSessionId(sessionId);
    
    try {
      const messagesData = await chatApi.getSessionMessages(sessionId);
      
      // Add unique IDs to messages and ensure correct rendering properties
      const messagesWithIds = messagesData.map(msg => {
        // Check if text contains HTML tags to automatically set HTML flags
        const containsHTML = typeof msg.text === 'string' && (
          msg.text.includes('<div') || 
          msg.text.includes('<span') || 
          msg.text.includes('<p')
        );
        
        // Process map messages specifically to ensure they render correctly
        if (msg.isEmbeddedMap === true) {
          console.log("Processing map message from database:", msg);
          return {
            ...msg,
            id: msg.id || generateUniqueId(),
            isEmbeddedMap: true,
            // Preserve map-specific properties
            selectedCoordinates: msg.selectedCoordinates || null,
            locationConfirmed: msg.locationConfirmed || false,
            // Ensure these are set to proper values for embedded maps
            html: false,
            isHTML: false
          };
        }
        
        // Process HTML messages
        return {
          ...msg,
          id: msg.id || generateUniqueId(),
          // Ensure both property versions exist for compatibility
          html: msg.isHTML || msg.html || containsHTML || false,
          isHTML: msg.isHTML || msg.html || containsHTML || false,
          isLocationData: msg.isLocationData || false,
          // Explicitly preserve embedded map flag
          isEmbeddedMap: msg.isEmbeddedMap || false
        };
      });
      
      console.log("Loaded messages:", messagesWithIds);
      setMessages(messagesWithIds);
      
      // Extract location data from messages if any
      const mapMessages = messagesWithIds.filter(msg => msg.isEmbeddedMap);
      if (mapMessages.length > 0) {
        const latestMapMessage = mapMessages[mapMessages.length - 1];
        if (latestMapMessage.selectedCoordinates) {
          // Initialize location state for this session
          setSessionLocationState(prev => ({
            ...prev,
            [sessionId]: {
              selectedLocation: latestMapMessage.selectedCoordinates,
              locationConfirmed: latestMapMessage.locationConfirmed || false,
            }
          }));
        }
      }
    } catch (error) {
      console.error(`Error loading messages for session ${sessionId}:`, error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new chat session
  const createNewSession = async (title = 'New Chat', initialMessages = []) => {
    try {
      setLoading(true);
      
      // Create a title based on the first user message
      const sessionTitle = title === 'New Chat' && initialMessages.length > 0
        ? initialMessages.find(m => m.sender === 'user')?.text.substring(0, 30) || title
        : title;
      
      const newSession = await chatApi.createChatSession(sessionTitle, initialMessages);
      
      // Set the new session as active
      setCurrentSessionId(newSession.sessionId);
      
      // Initialize location state for this session
      setSessionLocationState(prev => ({
        ...prev,
        [newSession.sessionId]: {
          showMapModal: false,
          selectedLocation: null,
          awaitingLocation: false,
          awaitingTimeDay: false,
          validatedTime: null,
          validatedDay: null,
          locationConfirmed: false,
        }
      }));
      
      // Refresh the session list
      await loadChatSessions();
      
      return newSession.sessionId;
    } catch (error) {
      console.error("Error creating new session:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Add a message to the current session
  const addMessage = async (message) => {
    // Add to local state first for immediate UI update
    setMessages(prevMessages => [...prevMessages, message]);
    
    // Then save to MongoDB if we have a session
    if (currentSessionId) {
      try {
        await chatApi.addMessageToSession(currentSessionId, message);
      } catch (error) {
        console.error("Error saving message:", error);
      }
    }
  };

  // Delete a chat session
  const deleteSession = async (sessionId) => {
    try {
      await chatApi.deleteSession(sessionId);
      
      // If we deleted the current session, clear it
      if (sessionId === currentSessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      
      // Remove session location state
      setSessionLocationState(prev => {
        const newState = {...prev};
        delete newState[sessionId];
        return newState;
      });
      
      // Refresh the session list
      await loadChatSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Rename a chat session
  const renameSession = async (sessionId, newTitle) => {
    try {
      await chatApi.updateSessionTitle(sessionId, newTitle);
      
      // Refresh the session list
      await loadChatSessions();
    } catch (error) {
      console.error("Error renaming session:", error);
    }
  };
  
  // Update location state for a specific session
  const updateSessionLocationState = (sessionId, newState) => {
    if (!sessionId) return;
    
    setSessionLocationState(prev => {
      // Get current state for this session or initialize if not exists
      const currentSessionState = prev[sessionId] || {
        showMapModal: false,
        selectedLocation: null,
        awaitingLocation: false,
        awaitingTimeDay: false,
        validatedTime: null,
        validatedDay: null,
        locationConfirmed: false,
      };
      
      // Return updated state
      return {
        ...prev,
        [sessionId]: {
          ...currentSessionState,
          ...newState
        }
      };
    });
  };
  
  // Get location state for a specific session
  const getSessionLocationState = (sessionId) => {
    if (!sessionId) return null;
    return sessionLocationState[sessionId] || {
      showMapModal: false,
      selectedLocation: null,
      awaitingLocation: false,
      awaitingTimeDay: false,
      validatedTime: null,
      validatedDay: null,
      locationConfirmed: false,
    };
  };

  // Load chat sessions on initial render
  useEffect(() => {
    loadChatSessions();
  }, []);

  // The context value that will be supplied to any descendants of this provider
  const contextValue = {
    chatSessions,
    currentSessionId,
    messages,
    loading,
    loadingChatSessions,
    loadChatSessions,
    loadSessionMessages,
    createNewSession,
    addMessage,
    deleteSession,
    renameSession,
    setCurrentSessionId,
    setMessages,
    // Add the new location state methods
    getSessionLocationState,
    updateSessionLocationState
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider; 