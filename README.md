# Inventory Management System

A simple, single-deployable web app for tracking products, stock levels, purchases, sales, and inventory movements. One Node.js process serves both the REST API and the React frontend, backed by PostgreSQL.

## Project Overview

Stock levels are never stored directly. They are derived from an append-only ledger of **inventory movements** (purchases, sales, and manual adjustments), so every change in stock is traceable. The server enforces business rules such as preventing overselling and duplicate SKUs, and uses database transactions with row locking to stay correct under concurrent requests.

## Features

- **Dashboard** – product count, stock value, total sales and purchases, and low-stock alerts
- **Products** – add, edit, delete, and search products; manual stock adjustments with a reason
- **Purchases** – record incoming stock with supplier and unit cost
- **Sales** – record outgoing stock; sales exceeding available stock are rejected
- **Movements** – full ledger filterable by type and product
- **Validation** – server-side input checks and unique (case-insensitive) SKUs
- **Single artifact** – Express serves the built React app and the API from one port

## Technology Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Frontend  | React 18, Vite                      |
| Backend   | Node.js, Express                    |
| Database  | PostgreSQL (tested on Neon) via `pg` |

## Installation Steps

**Prerequisites:** Node.js 20+ and a PostgreSQL database.

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Anusha00912/Inventory-Management-System.git
   cd Inventory-Management-System
   npm install
   ```
2. Configure the database connection:
   ```bash
   cp .env.example .env
   # edit .env and set DATABASE_URL
   ```
3. Run in development (Express with embedded Vite, hot reload) at http://localhost:3000:
   ```bash
   npm run dev
   ```
4. Or build and run for production:
   ```bash
   npm run build
   npm start
   ```

Tables are created automatically on first start, and sample data is loaded into an empty database.

**Configuration**

| Variable       | Description                         | Default |
| -------------- | ----------------------------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string        | –       |
| `PORT`         | Port the server listens on          | `3000`  |

## Future Enhancements

- User authentication and role-based access
- Multiple warehouses / locations
- Delete or reverse purchases and sales
- CSV import/export and printable reports
- Charts and sales/stock trend analytics
- Barcode scanning and supplier management
- Automated tests and CI pipeline
