import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`xlt-token NestJS example listening on http://localhost:${port}`);
  console.log('See examples/nestjs/README.md for curl recipes.');
}

bootstrap();
