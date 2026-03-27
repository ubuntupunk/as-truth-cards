import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname from 'path';
import cardsRouter from './api/cards.js';
import interactionsRouter from './api/interactions.js';

const app = express();
const PORT = process.env.PORT || 3001;

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = dirname(dirname(currentFilePath));
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

app.use('/api/cards', cardsRouter);
app.use('/api/interactions', interactionsRouter);

if (isProduction) {
  app.use(express.static(path.join(projectRoot, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(projectRoot, 'dist/index.html'));
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;