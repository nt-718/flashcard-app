import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const LOG_FILE = path.join(__dirname, '../logs/study_history.json');

// Ensure log directory exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

app.post('/api/log', (req, res) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ...req.body
    };

    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        try {
            logs = JSON.parse(data);
        } catch (e) {
            logs = [];
        }
    }

    logs.push(logEntry);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

    console.log(`Log saved: ${logEntry.material} (${logEntry.language}) – ${logEntry.accuracy ?? '?'}% accuracy`);
    res.status(200).send({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Logging server running on http://localhost:${port}`);
});
