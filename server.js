const path = require('path');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

const BACKUP_URL = 'https://api.jsonbin.io/v3/b';
const BACKUP_KEY = process.env.JSONBIN_API_KEY || '$2a$10$YourAPIKeyHere';
let BACKUP_ID = process.env.JSONBIN_BIN_ID || null;

const saveData = async (data) => {
  const filePath = path.join(__dirname, 'db.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('💾 Data saved to db.json at', new Date().toLocaleTimeString());

  await saveToExternalBackup(data);
};

const saveToExternalBackup = async (data) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': BACKUP_KEY
      }
    };

    if (BACKUP_ID) {
      await axios.put(`${BACKUP_URL}/${BACKUP_ID}`, data, config);
      console.log('☁️ External backup updated successfully');
    } else {

      const response = await axios.post(BACKUP_URL, data, config);
      BACKUP_ID = response.data.metadata.id;
      console.log('☁️ External backup created with ID:', BACKUP_ID);
    }
  } catch (error) {
    console.error('❌ External backup failed:', error.message);
  }
};

const loadFromExternalBackup = async () => {
  try {
    if (BACKUP_ID) {
      const response = await axios.get(`${BACKUP_URL}/${BACKUP_ID}/latest`, {
        headers: { 'X-Master-Key': BACKUP_KEY }
      });
      console.log('☁️ Data loaded from external backup');
      return response.data.record;
    }
  } catch (error) {
    console.error('❌ Failed to load from external backup:', error.message);
  }
  return null;
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
  console.log('📊 Backup requested - Current data:', JSON.stringify(data, null, 2));
  res.json(data);
});

server.get('/test-save', (req, res) => {
  const db = router.db;
  const currentTime = new Date().toISOString();
  console.log('🧪 Test endpoint called at', currentTime);
  console.log('📊 Current database state:', JSON.stringify(db.getState(), null, 2));
  res.json({
    message: 'Test endpoint - check console for data',
    timestamp: currentTime,
    data: db.getState()
  });
});

server.post('/restore', async (req, res) => {
  const db = router.db;
  db.setState(req.body);
  await saveData(req.body);
  res.json({ message: 'Data restored successfully' });
});

server.put('/settings', async (req, res) => {
  const db = router.db;
  db.set('settings', req.body).write();
  await saveData(db.getState());
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
        saveData(db.getState()); // Note: não aguardamos aqui para não bloquear a resposta
      }
      originalSend.call(this, data);
    };
  }
  next();
});

server.use(router);

const port = process.env.PORT || 8080;
server.listen(port, async () => {
  console.log('JSON Server is running on port', port);

  // Tentar carregar dados do backup externo na inicialização
  const backupData = await loadFromExternalBackup();
  if (backupData) {
    const db = router.db;
    db.setState(backupData);
    console.log('✅ Database restored from external backup');
  }

  // Auto-save a cada 2 minutos (reduzido para testar mais rápido)
  setInterval(async () => {
    try {
      const db = router.db;
      if (db) {
        await saveData(db.getState());
        console.log('⏰ Auto-save completed at', new Date().toISOString());
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, 2 * 60 * 1000); // 2 minutos
});