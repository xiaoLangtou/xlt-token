import { join } from 'node:path';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  app.useStaticAssets(join(__dirname, '..', 'public', 'demo'), { prefix: '/demo/' });

  const express = app.getHttpAdapter().getInstance();
  express.get('/', (_req: unknown, res: { redirect: (url: string) => void }) => {
    res.redirect('/demo/');
  });

  await app.listen(port);
  console.log(`xlt-token NestJS example listening on http://localhost:${port}`);
  console.log(`Interactive demo: http://localhost:${port}/demo/`);
}

bootstrap();
