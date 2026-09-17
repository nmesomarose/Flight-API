import { Router } from 'express';
import { airlinesRouter } from '../modules/airlines/airlines.routes';
import { bookingsRouter } from '../modules/bookings/bookings.routes';
import { customersRouter } from '../modules/customers/customers.routes';
import { flightsRouter } from '../modules/flights/flights.routes';

// Aggregates all v1 routes. Mounted on the app under `/v1/`.
export const v1Router = Router();

v1Router.use('/airlines', airlinesRouter);
v1Router.use('/flights', flightsRouter);
v1Router.use('/customers', customersRouter);
v1Router.use('/bookings', bookingsRouter);