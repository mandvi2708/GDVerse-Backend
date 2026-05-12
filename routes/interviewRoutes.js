const express = require('express');
const router = express.Router();
const multer = require('multer');
const interviewController = require('../controllers/interviewController');
const auth = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/my-interviews', auth, interviewController.getMyInterviews);
router.post('/start', auth, upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'jd', maxCount: 1 }
]), interviewController.startInterview);

router.post('/submit-answer', auth, interviewController.submitAnswer);
router.get('/report/:id', auth, interviewController.getReport);
router.get('/:id', auth, interviewController.getInterview);



module.exports = router;
