import express from 'express';
import cors from 'cors';
import routes from './routes/index';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'EntregaProva API is running' });
});

app.use('/api/v1', routes);

export default app;