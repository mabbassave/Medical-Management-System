import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { DashboardController } from '../controllers/Dashboard.controller';

const dashboardRouter = Router();

// Protect all dashboard routes with authentication
dashboardRouter.use(authMiddleware as any);

const dashboardController = new DashboardController();

// Only Admin and Doctor are authorized to access dashboard statistics
dashboardRouter.get('/stats', requireRole('admin', 'doctor'), dashboardController.getStats);
dashboardRouter.get('/', requireRole('admin', 'doctor'), dashboardController.getStats);

export default dashboardRouter;
