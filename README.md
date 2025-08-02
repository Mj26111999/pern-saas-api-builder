# 🚀 PERN Stack SaaS Multi-Tenant API Builder

A comprehensive **SaaS Multi-Tenant API Builder** that allows users to connect to any database and generate production-ready APIs in multiple programming languages with real-time capabilities.

## 🏗️ Architecture

**PERN Stack:**
- **P**ostgreSQL - Multi-tenant database with isolated data
- **E**xpress.js - Backend API with real-time WebSocket support  
- **R**eact.js - Modern frontend with Material-UI
- **N**ode.js - Server runtime with multi-database support

## ✨ Key Features

### 🔌 Multi-Database Support
- **Supported Databases:** PostgreSQL, MySQL, MongoDB, Redis, SQLite
- Real-time connection testing and validation
- Connection pooling for optimal performance
- SSL/TLS encryption support
- Encrypted credential storage

### 🚀 Multi-Language API Generation
- **Languages:** Python (Flask), Node.js (Express), Go (Gin), Java (Spring Boot), PHP (Laravel), Ruby (Rails), C# (.NET)
- Auto-generated Docker containers
- Production-ready code with error handling
- RESTful API standards compliance
- Built-in authentication and rate limiting

### ⚡ Real-Time Features
- WebSocket connections for live query execution
- Real-time collaboration on API building
- Live database connection status monitoring
- Instant code generation and preview
- Real-time usage analytics

### 🏢 Multi-Tenant Architecture
- Complete tenant isolation and data security
- API key-based authentication
- Usage analytics and monitoring
- Rate limiting and quota management
- Subscription-based pricing tiers

### 🎨 Modern Frontend
- React.js with Material-UI components
- Monaco code editor for SQL queries
- Interactive dashboard with real-time analytics
- Drag-and-drop query builder
- Responsive design for all devices
- Dark/Light theme support

## 📊 Business Model

| Plan | Price | Endpoints | Requests/Day | Databases | Languages |
|------|-------|-----------|--------------|-----------|-----------|
| **Basic** | $29/month | 10 | 10K | 2 connections | 3 languages |
| **Pro** | $99/month | 100 | 100K | 10 connections | All languages |
| **Enterprise** | $299/month | Unlimited | 1M | Unlimited | All + Custom |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for development)
- PostgreSQL 15+ (if running locally)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Mj26111999/pern-saas-api-builder.git
cd pern-saas-api-builder

# Start the development environment
docker-compose up -d

# Install dependencies (for local development)
cd backend && npm install
cd ../frontend && npm install
```

### Access Points
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Database:** localhost:5432
- **Redis:** localhost:6379

## 📁 Project Structure

```
pern-saas-api-builder/
├── backend/                 # Express.js API server
│   ├── handlers/           # Database connection handlers
│   ├── routes/             # API routes
│   ├── middleware/         # Authentication & validation
│   ├── models/             # Database models
│   ├── services/           # Business logic
│   └── utils/              # Helper functions
├── frontend/               # React.js application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # Redux store
│   │   ├── services/       # API services
│   │   └── utils/          # Utilities
├── database/               # Database schemas & migrations
├── docker/                 # Docker configurations
├── k8s/                    # Kubernetes deployments
└── docs/                   # Documentation
```

## 🔧 Technology Stack

### Backend
- **Framework:** Express.js + Node.js
- **Database:** PostgreSQL (primary) + Multi-DB support
- **Real-time:** Socket.IO WebSockets
- **Authentication:** JWT + API Keys
- **Security:** Helmet, CORS, Rate Limiting
- **ORM:** Prisma / Sequelize

### Frontend
- **Framework:** React.js 18+
- **State Management:** Redux Toolkit
- **UI Library:** Material-UI (MUI)
- **Code Editor:** Monaco Editor
- **Real-time:** Socket.IO Client
- **HTTP Client:** Axios + React Query

### DevOps & Deployment
- **Containerization:** Docker + Docker Compose
- **Orchestration:** Kubernetes
- **Reverse Proxy:** Nginx
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack
- **CI/CD:** GitHub Actions

## 🐳 Deployment

### Docker Deployment
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up -d --scale backend=3
```

### Kubernetes Deployment
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Scale the application
kubectl scale deployment pern-api-builder --replicas=5
```

## 🔐 Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=api_builder
DB_USER=postgres
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://localhost:3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📚 API Documentation

### Authentication
All API endpoints require authentication via API key:
```bash
curl -H "X-API-Key: your_api_key" http://localhost:5000/api/endpoints
```

### Core Endpoints
- `POST /api/tenants` - Create new tenant
- `GET /api/tenant/profile` - Get tenant profile
- `POST /api/tenant/databases` - Add database connection
- `POST /api/tenant/endpoints` - Create API endpoint
- `POST /api/tenant/generate/:language` - Generate API code

## 🧪 Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Integration tests
npm run test:integration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the powerful PERN stack
- Inspired by modern SaaS architecture patterns
- Thanks to the open-source community

## 📞 Support

- **Documentation:** [Wiki](https://github.com/Mj26111999/pern-saas-api-builder/wiki)
- **Issues:** [GitHub Issues](https://github.com/Mj26111999/pern-saas-api-builder/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Mj26111999/pern-saas-api-builder/discussions)

---

**⭐ Star this repository if you find it helpful!**

Built with ❤️ by [Michel Jackson](https://github.com/Mj26111999)