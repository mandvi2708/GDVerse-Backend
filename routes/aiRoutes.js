const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/generate-mom/:sessionId', aiController.generateMOM);
router.get('/mom/:sessionId', aiController.getMOM);
router.post('/bot-response', aiController.getBotResponse);

module.exports = router;
