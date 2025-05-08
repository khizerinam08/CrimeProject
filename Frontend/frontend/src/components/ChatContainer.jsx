import { useState } from 'react';
import ChatHistory from './ChatHistory';
import ChatMessages from './ChatMessages';
import { chatHistoryApi } from '../api/chatHistoryApi';

/**
 * Container component that manages chat history and messages
 */
const ChatContainer = () => {
  const [activeChatId, setActiveChatId] = useState(null);

  // Handle chat selection
  const handleChatSelected = (chatId) => {
    setActiveChatId(chatId);
  };

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <ChatHistory 
          activeChatId={activeChatId} 
          onChatSelected={handleChatSelected} 
        />
      </aside>
      
      <main className="chat-main">
        <ChatMessages chatId={activeChatId} />
      </main>
    </div>
  );
};

export default ChatContainer; 