const path = require('node:path');
require('../dist/server.cjs').startServer({ rootDir: path.join(__dirname, '..'), port: Number(process.env.PORT || 3000) }).then(backend => {
  console.log(backend.url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void backend.close());
}).catch(error => { console.error(error); process.exitCode = 1; });
