/*
 * Project:     Oshikatsu-Labo - AethericEngineDoc (Coding Challenge)
 * File:        connect.ts
 * Date:        2025-12-08
 * Author:      Steffen Haase <shworx.development@gmail.com
 * Copyright:   2025 SHWorX (Steffen Haase)
 */

import net from 'net';
import Database from 'better-sqlite3';

const db = new Database('messages.sqlite');

db.prepare(`
    CREATE TABLE IF NOT EXISTS msgascii (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        payload TEXT NOT NULL
    )
`).run();
db.prepare(`
    CREATE TABLE IF NOT EXISTS msgbinary (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        payload BLOB NOT NULL
    )
`).run();


// === Configuration ===
const SERVER_IP = '35.213.160.152';
const SERVER_PORT = 8080;
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdGVmZmVuQGthc2FnaWxhYm8uY29tIiwianRpIjoiZWQyOTc3ODgtMTc4Yi00MzU3LTgzNDktMzg4MGM4MTRlMTVmIiwibmJmIjoxNzY1MTc0NDI3LCJleHAiOjE3NjYzODQwMjcsImlhdCI6MTc2NTE3NDQyNywiaXNzIjoiUHJvZ3JhbW1pbmdTa2lsbENoYWxsZW5nZSIsImF1ZCI6IkludGVydmlld2VlcyJ9.m34U83qXju0jAdgkMfjP207DuQn1yJNKVx17Ixhxhi8'; // <-- replace with your token
const TARGET_MESSAGES = 600;

const ASCII_START = 0x24; // '$'
const ASCII_END = 0x3B;   // ';'
const BINARY_HEADER = 0xAA;

let countAscii = 0;
let countBinary = 0;

// === TCP Client ===
let buffer = Buffer.alloc(0);
let totalMessages = 0;

const client = net.createConnection({ host: SERVER_IP, port: SERVER_PORT }, () => {
    console.log('Connected to AE. Authenticating...');
    client.write(`AUTH ${JWT_TOKEN}`);
});

client.on("data", (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);

    let processed = true;
    while (processed) {
        processed = false;

        // --- Check for binary message first ---
        const binHeaderIdx = buffer.indexOf(BINARY_HEADER);
        if (binHeaderIdx !== -1 && buffer.length >= binHeaderIdx + 6) {
            const lengthBytes = buffer.slice(binHeaderIdx + 1, binHeaderIdx + 6);
            const payloadLength = lengthBytes.readUIntBE(0, 5);
            const totalLen = 6 + payloadLength;

            // if (buffer.length >= binHeaderIdx + totalLen) {
                const payload = buffer.slice(binHeaderIdx + 6, binHeaderIdx + 6 + payloadLength);
                insertMessage(payload, true);
                totalMessages++;
                buffer = buffer.slice(binHeaderIdx + totalLen);
                processed = true;
                // continue; // continue parsing after consuming binary
            // }
        }

        // --- Only check ASCII if no binary at start ---
        const asciiStartIdx = buffer.indexOf(ASCII_START);
        const asciiEndIdx = buffer.indexOf(ASCII_END, asciiStartIdx + 1);

        if (asciiStartIdx !== -1 && asciiEndIdx !== -1 && asciiEndIdx > asciiStartIdx) {
            // Make sure this ASCII message **doesn't overlap a binary header**
            if (asciiStartIdx < binHeaderIdx || binHeaderIdx === -1) {
                const payload = buffer.slice(asciiStartIdx + 1, asciiEndIdx);
                if (payload.length >= 5) {
                    insertMessage(payload.toString("utf-8"), false);
                    totalMessages++;
                }
                buffer = buffer.slice(asciiEndIdx + 1);
                processed = true;
            }
        }
    }

    if (totalMessages >= TARGET_MESSAGES) {
        console.log(`Collected ${totalMessages} messages. Stopping AE...`);
        client.write("STATUS\n");
        client.end();
    }
});
client.on('close', () => {
    console.log('Connection closed. Done.');

    console.log(`Total messages written to DB: ${countAscii} ASCII, ${countBinary} BINARY.`);
    // db.close();
});

client.on('error', (err) => {
    console.error('TCP Error:', err.message);
    // db.close();
});

async function insertMessage(payload: string | Buffer, isBinary: boolean) {

    console.log(`\nWriting ${isBinary ? 'binary' : 'ascii'} data to database.`, payload);
    // return Promise.resolve();

    try {
        if (isBinary) {
            const stmt = db.prepare('INSERT INTO msgbinary (payload) VALUES (?)');
            stmt.run(payload);
            countBinary++;
        } else {
            const stmt = db.prepare('INSERT INTO msgascii (payload) VALUES (?)');
            stmt.run(payload);
            countAscii++;
        }

    } catch (err) {
        console.error('DB error:', err);
    }
}
