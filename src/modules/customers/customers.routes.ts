import { Router } from 'express';
import {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  listCustomerBookings,
} from './customers.handler';

export const customersRouter = Router();

// List customers
customersRouter.get('/', listCustomers);

// Create customer
customersRouter.post('/', createCustomer);

// Get customer by ID
customersRouter.get('/:id', getCustomer);

// Update customer
customersRouter.patch('/:id', updateCustomer);

// Delete customer
customersRouter.delete('/:id', deleteCustomer);

// List bookings belonging to a given customer (relationship-scoped)
customersRouter.get('/:id/bookings', listCustomerBookings);
