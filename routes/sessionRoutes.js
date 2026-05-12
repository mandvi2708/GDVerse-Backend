const express = require('express');
const router = express.Router();
const {
  createSession,
  getUserSessions,
  deleteSession,
  getSessionByInviteLink,
  getAllSessions,
  updateSessionSettings
} = require('../controllers/sessionController');

router.post('/create', createSession);
router.get('/my-sessions', getUserSessions);
router.get('/all', getAllSessions);
router.get('/join/:inviteLink', getSessionByInviteLink); // ✅ optional, for GD room
router.post('/update/:inviteLink', updateSessionSettings);
router.delete('/delete/:id', deleteSession);

module.exports = router;
