const path = require('path');
const cors = require('cors');
const fs = require('fs');
const jsonServer = require('json-server');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

// Sistema de salvamento otimizado
const saveData = (data) => {
  try {
    const filePath = path.join(__dirname, 'db.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('💾 Data saved at', new Date().toLocaleTimeString());
  } catch (error) {
    console.error('❌ Save error:', error);
  }
};

server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

server.get('/settings', (req, res) => {
  const db = router.db;
  res.json(db.get('settings').value());
});

server.get('/backup', (req, res) => {
  const db = router.db;
  const data = db.getState();
  res.json(data);
});

server.get('/test-save', (req, res) => {
  const db = router.db;
  res.json({
    message: 'Server running',
    timestamp: new Date().toISOString(),
    dataCount: db.get('days').value().length
  });
});

server.post('/restore', (req, res) => {
  const db = router.db;
  db.setState(req.body);
  saveData(req.body);
  res.json({ message: 'Data restored successfully' });
});

server.put('/settings', (req, res) => {
  const db = router.db;
  db.set('settings', req.body).write();
  saveData(db.getState());
  res.json(db.get('settings').value());
});

server.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    console.log(`🔄 ${req.method} request to ${req.path}`);
    const originalSend = res.send;
    res.send = function (data) {
      const db = router.db;
      if (db) {
        console.log('💾 Triggering save after', req.method, 'request');
        saveData(db.getState());
      }
      originalSend.call(this, data);
    };
  }
  next();
});

server.use(router);

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log('🚀 JSON Server running on port', port);

  // Auto-save reduzido para 5 minutos
  setInterval(() => {
    try {
      const db = router.db;
      if (db) {
        saveData(db.getState());
        console.log('⏰ Auto-save at', new Date().toISOString());
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutos
});