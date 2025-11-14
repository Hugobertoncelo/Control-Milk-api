const path = require('path');
const cors = require('cors');
const fs = require('fs');
const jsonServer = require('json-server');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

// Sistema de backup em memória
let memoryBackup = null;

const saveData = (data) => {
  // Salva no arquivo local
  const filePath = path.join(__dirname, 'db.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('💾 Data saved to db.json at', new Date().toLocaleTimeString());
  
  // Salva no backup em memória
  memoryBackup = JSON.parse(JSON.stringify(data)); // Deep copy
  console.log('🧠 Backup saved in memory');
  
  // Log para monitoramento
  if (data.days && data.days.length > 0) {
    console.log('📅 Days in database:', data.days.length);
    console.log('📊 Last day data:', data.days[data.days.length - 1].date);
  }
};

// Função para restaurar dados na inicialização
const initializeDatabase = () => {
  const db = router.db;
  
  // Se temos backup em memória, usa ele
  if (memoryBackup) {
    db.setState(memoryBackup);
    console.log('✅ Database restored from memory backup');
    
    // Salva no arquivo local também
    const filePath = path.join(__dirname, 'db.json');
    fs.writeFileSync(filePath, JSON.stringify(memoryBackup, null, 2));
  } else {
    console.log('📄 Using local db.json file');
    // Salva o estado atual no backup
    memoryBackup = JSON.parse(JSON.stringify(db.getState()));
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
  console.log('JSON Server is running on port', port);
  
  // Inicializa o banco de dados com dados do backup se disponível
  initializeDatabase();

  // Auto-save a cada 1 minuto
  setInterval(() => {
    try {
      const db = router.db;
      if (db) {
        saveData(db.getState());
        console.log('⏰ Auto-save completed at', new Date().toISOString());
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, 1 * 60 * 1000); // 1 minuto
});