const Chat = require('../models/Chat');
const { v4: uuidv4 } = require('uuid');

// Get a chat by ID
exports.getChatById = async (req, res) => {
  try {
    const chat = await Chat.findOne({ chatId: req.params.chatId });
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new chat
exports.createChat = async (req, res) => {
  try {
    const { title, sessionId } = req.body;
    
    const newChat = new Chat({
      chatId: uuidv4(),
      title: title || 'New Chat',
      sessionId: sessionId || null,
      messages: []
    });
    
    const savedChat = await newChat.save();
    res.status(201).json({ success: true, data: savedChat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a message to a chat
exports.addMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, sender, html } = req.body;
    
    if (!text || !sender) {
      return res.status(400).json({ success: false, message: 'Message text and sender are required' });
    }
    
    const chat = await Chat.findOne({ chatId });
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    
    // Add the message to the chat
    chat.messages.push({
      text,
      sender,
      html: html || false,
      timestamp: new Date()
    });
    
    const updatedChat = await chat.save();
    res.status(200).json({ success: true, data: updatedChat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a chat
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const result = await Chat.findOneAndDelete({ chatId });
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    
    res.status(200).json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all chats (for future multi-chat support)
exports.getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}; 