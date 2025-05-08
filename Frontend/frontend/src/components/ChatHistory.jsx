import { useState, useEffect } from 'react';
import { chatHistoryApi } from '../api/chatHistoryApi';

/**
 * Example component showing how to integrate with the chat history API
 * This is a simplified implementation for demonstration purposes
 */
const ChatHistory = ({ activeChatId, onChatSelected }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all chats on component mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const response = await chatHistoryApi.getAllChats();
        
        if (response.success) {
          setChats(response.data);
          
          // If no active chat is selected but we have chats, select the first one
          if (!activeChatId && response.data.length > 0) {
            onChatSelected(response.data[0].chatId);
          }
        } else {
          setError('Failed to load chats');
        }
      } catch (error) {
        setError('Error loading chats: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [activeChatId, onChatSelected]);

  // Create a new chat
  const handleCreateChat = async () => {
    try {
      const response = await chatHistoryApi.createChat('New Chat');
      
      if (response.success) {
        setChats([...chats, response.data]);
        onChatSelected(response.data.chatId);
      }
    } catch (error) {
      setError('Error creating chat: ' + error.message);
    }
  };

  // Delete a chat
  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation(); // Prevent triggering chat selection
    
    try {
      const response = await chatHistoryApi.deleteChat(chatId);
      
      if (response.success) {
        // Remove the deleted chat from state
        setChats(chats.filter(chat => chat.chatId !== chatId));
        
        // If the active chat was deleted, select another one
        if (chatId === activeChatId && chats.length > 1) {
          const remainingChats = chats.filter(chat => chat.chatId !== chatId);
          onChatSelected(remainingChats[0].chatId);
        }
      }
    } catch (error) {
      setError('Error deleting chat: ' + error.message);
    }
  };

  if (loading) return <div>Loading chats...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-history">
      <div className="chat-list-header">
        <h2>Chat History</h2>
        <button onClick={handleCreateChat}>New Chat</button>
      </div>
      
      <ul className="chat-list">
        {chats.length === 0 ? (
          <li className="empty-chats">No chats yet. Create a new one!</li>
        ) : (
          chats.map(chat => (
            <li 
              key={chat.chatId} 
              className={chat.chatId === activeChatId ? 'active' : ''}
              onClick={() => onChatSelected(chat.chatId)}
            >
              <span className="chat-title">{chat.title}</span>
              <span className="chat-date">
                {new Date(chat.updatedAt).toLocaleDateString()}
              </span>
              <button 
                className="delete-chat"
                onClick={(e) => handleDeleteChat(chat.chatId, e)}
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default ChatHistory; 