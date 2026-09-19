import express from 'express';
import { createApp } from './app-factory';
import { loadConfig } from './config';

const config = loadConfig(process.env);
const app = createApp(config);

// Vercel entry point: the Express app is the module's default export so that
// Vercel's zero-configuration Express detection (src/index.ts is a recognized
// entry location) can wrap it into a single Vercel Function. The app.listen
// below only runs when this file is executed directly (npm start → node
// dist/index.js); it never runs when Vercel imports the module as a Function.
export default app;

if (typeof require !== 'undefined' && require.main === module) {
  app.listen(config.port, () => {
    console.log(`Flight Booking API listening on port ${config.port}`);
  });
}