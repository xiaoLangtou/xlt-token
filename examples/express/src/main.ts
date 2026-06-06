import { createApp } from './app';

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`xlt-token Express example listening on http://localhost:${config.port}`);
  console.log(`Interactive demo: http://localhost:${config.port}/demo/`);
});
