const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/mom', aiController.generateMOM);
router.post('/feedback', aiController.getInterviewFeedback);
router.post('/interview', aiController.getBotResponse);
router.get('/debug', aiController.debugAI);

module.exports = router;
