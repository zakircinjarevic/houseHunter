import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Admin credentials (in production, use environment variables or a database)
const ADMIN_USERNAME = 'zak';
const ADMIN_PASSWORD = 'zak';

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Set session
      req.session!.isAuthenticated = true;
      req.session!.username = username;
      
      logger.info(`Admin login successful: ${username}`);
      
      res.json({ 
        success: true, 
        message: 'Login successful',
        username: username
      });
    } else {
      logger.warn(`Admin login failed: ${username}`);
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error: any) {
    logger.error('Error in admin login:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/admin/logout
 * Admin logout endpoint
 */
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.session!.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    logger.info('Admin logout successful');
    res.json({ success: true, message: 'Logout successful' });
  });
});

/**
 * GET /api/admin/me
 * Get current admin session info
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ 
    authenticated: true,
    username: req.session!.username
  });
});

/**
 * GET /api/admin/check
 * Check if user is authenticated (public endpoint)
 */
router.get('/check', (req: Request, res: Response) => {
  res.json({ 
    authenticated: req.session?.isAuthenticated || false,
    username: req.session?.username || null
  });
});

export default router;

