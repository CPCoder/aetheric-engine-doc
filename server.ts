/*
 * Project:     Oshikatsu-Labo - AethericEngineDoc (Coding Challenge)
 * File:        server.ts
 * Date:        2025-12-08
 * Author:      Steffen Haase <shworx.development@gmail.com
 * Copyright:   2025 SHWorX (Steffen Haase)
 */

import express from 'express';
import Database from 'better-sqlite3';
import { dirname } from 'path';
import path from 'path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database('messages.sqlite');
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.get('/api/ascii', (req, res) => {
    const rows = db.prepare('SELECT id, payload FROM msgascii ORDER BY id DESC').all();
    res.json(rows);
});
app.get('/api/binary', (req, res) => {
    const rows = db.prepare('SELECT id, payload FROM msgbinary ORDER BY id DESC').all();
    const formatted = rows.map(r => ({
        id: r.id,
        payload: Buffer.from(r.payload).toString('hex')
    }));
    res.json(formatted);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`DB viewer running at http://localhost:${PORT}`);
});