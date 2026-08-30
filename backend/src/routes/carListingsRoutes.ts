import { Router } from 'express';
import prisma from '../db/prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const skip = page * limit;

    const [listings, total] = await Promise.all([
      prisma.carListing.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.carListing.count(),
    ]);

    const parsed = listings.map((l) => ({
      ...l,
      images: (() => { try { return JSON.parse(l.images); } catch { return []; } })(),
    }));

    res.json({ listings: parsed, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
