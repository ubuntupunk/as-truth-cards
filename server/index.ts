import express from 'express';
import cors from 'cors';
import cardsRouter from './api/cards.js';
import interactionsRouter from './api/interactions.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/cards', cardsRouter);
app.use('/api/interactions', interactionsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;