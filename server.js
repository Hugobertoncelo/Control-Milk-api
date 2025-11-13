const path = require('path');
const cors = require('cors');
const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

server.get('/settings', (req, res) => {
  const db = router.db;
  res.json(db.get('settings').value());
});

server.put('/settings', (req, res) => {
  const db = router.db;
  db.set('settings', req.body).write();
  res.json(db.get('settings').value());
});

server.use(router);

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log('JSON Server is running on port', port);
});