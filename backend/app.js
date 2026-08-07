const express = require('express');
const cors = require('cors');
const productRepository = require('./productRepository');
const checkoutService = require('./checkoutService');
const stockReportRepository = require('./stockReportRepository');
const financialReportRepository = require('./financialReportRepository');
const paymentReportRepository = require('./paymentReportRepository');
const orderRepository = require('./orderRepository');
const orderEditService = require('./orderEditService');
const orderDeleteService = require('./orderDeleteService');
const orderCancelService = require('./orderCancelService');
const customerRepository = require('./customerRepository');
const inventoryService = require('./inventoryService');
const healthService = require('./healthService');

function createApp({
  products = productRepository,
  checkout = checkoutService,
  stockReports = stockReportRepository,
  financialReports = financialReportRepository,
  paymentReports = paymentReportRepository,
  orders = orderRepository,
  orderEdits = orderEditService,
  orderDeletes = orderDeleteService,
  orderCancels = orderCancelService,
  customers = customerRepository,
  inventory = inventoryService,
  health = healthService,
  logger = console,
} = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // This endpoint only makes a read-only database ping; it does not expose or
  // modify business data.
  app.get('/api/health', async (req, res) => {
    try {
      res.json(await health.check());
    } catch (error) {
      logger.error('Health check database ping failed.', error);
      res.status(503).json({ status: 'unavailable', database: 'disconnected' });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      res.json(await products.listProducts());
    } catch (error) {
      logger.error('Unable to load products from the database.', error);
      res.status(500).json({ error: 'Unable to load products.' });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      res.status(201).json(await products.createProduct(req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to create product.', error);
      res.status(500).json({ error: 'Unable to create product.' });
    }
  });

  app.post('/api/checkout', async (req, res) => {
    try {
      res.status(201).json(await checkout.checkout(req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to complete checkout.', error);
      res.status(500).json({ error: 'Unable to complete checkout.' });
    }
  });

  app.get('/api/customers', async (req, res) => {
    try {
      res.json(await customers.listCustomerProfiles());
    } catch (error) {
      logger.error('Unable to load customer profiles.', error);
      res.status(500).json({ error: 'Unable to load customer profiles.' });
    }
  });

  app.post('/api/inventory/receipts', async (req, res) => {
    try {
      res.status(201).json(await inventory.receiveStock(req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to receive inventory.', error);
      res.status(500).json({ error: 'Unable to receive inventory.' });
    }
  });

  app.post('/api/inventory/personal-usage', async (req, res) => {
    try {
      res.status(201).json(await inventory.recordPersonalUsage(req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to record personal usage.', error);
      res.status(500).json({ error: 'Unable to record personal usage.' });
    }
  });

  app.get('/api/reports/monthly-stock', async (req, res) => {
    try {
      res.json(await stockReports.getMonthlyStock(req.query.month));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to load the monthly stock report.', error);
      res.status(500).json({ error: 'Unable to load the monthly stock report.' });
    }
  });

  app.get('/api/reports/monthly-finance', async (req, res) => {
    try {
      res.json(await financialReports.listMonthlyFinance());
    } catch (error) {
      logger.error('Unable to load the monthly finance report.', error);
      res.status(500).json({ error: 'Unable to load the monthly finance report.' });
    }
  });

  app.get('/api/reports/monthly-payments', async (req, res) => {
    try {
      res.json(await paymentReports.listMonthlyPayments());
    } catch (error) {
      logger.error('Unable to load the monthly payment report.', error);
      res.status(500).json({ error: 'Unable to load the monthly payment report.' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      res.json(await orders.listOrders(req.query.month));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to load order history.', error);
      res.status(500).json({ error: 'Unable to load order history.' });
    }
  });

  app.put('/api/orders/:id', async (req, res) => {
    try {
      res.json(await orderEdits.updateOrder(req.params.id, req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to update order.', error);
      res.status(500).json({ error: 'Unable to update order.' });
    }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try {
      res.json(await orderDeletes.deleteOrder(req.params.id));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to delete order.', error);
      res.status(500).json({ error: 'Unable to delete order.' });
    }
  });

  app.post('/api/orders/:id/cancel', async (req, res) => {
    try {
      res.json(await orderCancels.cancelOrder(req.params.id, req.body));
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Unable to cancel order.', error);
      res.status(500).json({ error: 'Unable to cancel order.' });
    }
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
