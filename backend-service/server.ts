import { buildApp } from './src/app.js';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = buildApp();

app.listen({ port: PORT, host: HOST })
  .then((address: string) => {
    app.log.info({ address }, 'Backend service started');
  })
  .catch((err: Error) => {
    app.log.error(err, 'Failed to start backend service');
    process.exit(1);
  });

