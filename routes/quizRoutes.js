const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const auth = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/my-quizzes', auth, quizController.getMyQuizzes);
router.post('/generate', auth, upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'jd', maxCount: 1 }
]), quizController.generateQuiz);
router.get('/:id', auth, quizController.getQuiz);
router.post('/submit', auth, quizController.submitQuiz);


module.exports = router;
