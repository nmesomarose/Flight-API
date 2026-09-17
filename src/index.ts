import express from 'express';
import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig(process.env);
const app = createApp(config);

app.listen(config.port, () => {
  // No business logic is implemented yet — this only confirms the server boots.
  console.log(`Flight Booking API listening on port ${config.port}`);
});