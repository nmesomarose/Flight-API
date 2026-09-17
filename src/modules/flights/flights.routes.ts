import { Router } from 'express';
import {
  listFlights,
  createFlight,
  getFlight,
  updateFlight,
  deleteFlight,
  listFlightBookings,
} from './flights.handler';

export const flightsRouter = Router();

// List flights
flightsRouter.get('/', listFlights);

// Create flight
flightsRouter.post('/', createFlight);

// Get flight by ID
flightsRouter.get('/:id', getFlight);

// Update flight
flightsRouter.patch('/:id', updateFlight);

// Delete flight
flightsRouter.delete('/:id', deleteFlight);

// List bookings belonging to a given flight (relationship-scoped)
flightsRouter.get('/:id/bookings', listFlightBookings);
