import { Router } from 'express';
import {
  listAirlines,
  createAirline,
  getAirline,
  updateAirline,
  deleteAirline,
  listAirlineFlights,
} from './airlines.handler';

export const airlinesRouter = Router();

// List airlines
airlinesRouter.get('/', listAirlines);

// Create airline
airlinesRouter.post('/', createAirline);

// Get airline by ID
airlinesRouter.get('/:id', getAirline);

// Update airline
airlinesRouter.patch('/:id', updateAirline);

// Delete airline
airlinesRouter.delete('/:id', deleteAirline);

// List flights belonging to a given airline (relationship-scoped)
airlinesRouter.get('/:id/flights', listAirlineFlights);
