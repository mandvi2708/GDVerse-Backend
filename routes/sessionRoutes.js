const express = require('express');
const router = express.Router();
const {
  createSession,
  getUserSessions,
  deleteSession,
  getSessionByInviteLink
} = require('../controllers/sessionController');

router.post('/create', createSession);
router.get('/my-sessions', getUserSessions);
router.get('/join/:inviteLink', getSessionByInviteLink); // ✅ optional, for GD room
router.delete('/delete/:id', deleteSession);

module.exports = router;
