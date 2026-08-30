import { Router } from 'express';
import prisma from '../db/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const users = await prisma.carBotUser.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
