const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// GET all chats (for future multi-chat support)
router.get('/', chatController.getAllChats);

// GET a chat by ID
router.get('/:chatId', chatController.getChatById);

// POST create a new chat
router.post('/', chatController.createChat);

// PUT add a message to a chat
router.put('/:chatId/messages', chatController.addMessage);

// DELETE a chat
router.delete('/:chatId', chatController.deleteChat);

module.exports = router; 