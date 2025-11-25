import express, { Application, Request, Response, NextFunction } from 'express';
import healthRouter from './routes/health';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRouter);

// Default route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Charlaton Chat Microservice' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
