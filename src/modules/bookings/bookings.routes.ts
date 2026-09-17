import { Router } from 'express';
import { listBookings, createBooking, getBooking, deleteBooking } from './bookings.handler';

export const bookingsRouter = Router();

// List bookings
bookingsRouter.get('/', listBookings);

// Create booking
bookingsRouter.post('/', createBooking);

// Get booking by ID
bookingsRouter.get('/:id', getBooking);

// Delete booking — always allowed (represents cancellation).
// No update route exists for Bookings (booking-specific.md, AGENTS.md §3).
bookingsRouter.delete('/:id', deleteBooking);
