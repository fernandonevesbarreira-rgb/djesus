const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'djesus.db');
const db = new Database(dbPath);

// Init database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS encomendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num TEXT,
    data TEXT,
    entrega TEXT,
    estado TEXT DEFAULT 'ativa',
    cliente TEXT,
    ref_modelo TEXT,
    ref_final TEXT,
    confecao TEXT,
    notas TEXT,
    dados TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS base_dados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    dados TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encomenda_id INTEGER,
    secao TEXT,
    nome TEXT,
    tipo TEXT,
    dados TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
  );
`);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── ENCOMENDAS ──
app.get('/api/encomendas', (req, res) => {
  const rows = db.prepare('SELECT id, num, data, entrega, estado, cliente, ref_modelo, ref_final, confecao FROM encomendas ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/encomendas/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Não encontrado' });
  row.dados = row.dados ? JSON.parse(row.dados) : {};
  res.json(row);
});

app.post('/api/encomendas', (req, res) => {
  const { num, data, entrega, estado, cliente, ref_modelo, ref_final, confecao, notas, dados } = req.body;
  const result = db.prepare(`
    INSERT INTO encomendas (num, data, entrega, estado, cliente, ref_modelo, ref_final, confecao, notas, dados)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(num, data, entrega, estado||'ativa', cliente, ref_modelo, ref_final, confecao, notas, JSON.stringify(dados||{}));
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/encomendas/:id', (req, res) => {
  const { num, data, entrega, estado, cliente, ref_modelo, ref_final, confecao, notas, dados } = req.body;
  db.prepare(`
    UPDATE encomendas SET num=?, data=?, entrega=?, estado=?, cliente=?, ref_modelo=?, ref_final=?, confecao=?, notas=?, dados=?
    WHERE id=?
  `).run(num, data, entrega, estado, cliente, ref_modelo, ref_final, confecao, notas, JSON.stringify(dados||{}), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/encomendas/:id', (req, res) => {
  db.prepare('DELETE FROM encomendas WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM uploads WHERE encomenda_id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── BASE DE DADOS ──
app.get('/api/bd/:tipo', (req, res) => {
  const rows = db.prepare('SELECT * FROM base_dados WHERE tipo=? ORDER BY id').all(req.params.tipo);
  res.json(rows.map(r => ({ ...JSON.parse(r.dados), _id: r.id })));
});

app.post('/api/bd/:tipo', (req, res) => {
  const result = db.prepare('INSERT INTO base_dados (tipo, dados) VALUES (?, ?)').run(req.params.tipo, JSON.stringify(req.body));
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/bd/:tipo/:id', (req, res) => {
  db.prepare('UPDATE base_dados SET dados=? WHERE id=?').run(JSON.stringify(req.body), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/bd/:tipo/:id', (req, res) => {
  db.prepare('DELETE FROM base_dados WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── UPLOADS ──
app.post('/api/uploads/:encId/:secao', (req, res) => {
  const { nome, tipo, dados } = req.body;
  const result = db.prepare('INSERT INTO uploads (encomenda_id, secao, nome, tipo, dados) VALUES (?,?,?,?,?)').run(req.params.encId, req.params.secao, nome, tipo, dados);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/uploads/:encId/:secao', (req, res) => {
  const rows = db.prepare('SELECT id, nome, tipo, dados FROM uploads WHERE encomenda_id=? AND secao=?').all(req.params.encId, req.params.secao);
  res.json(rows);
});

app.delete('/api/uploads/:id', (req, res) => {
  db.prepare('DELETE FROM uploads WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Serve app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`DJESUS a correr na porta ${PORT}`));
