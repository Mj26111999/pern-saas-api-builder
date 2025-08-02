# 🚀 Deployment Guide - PERN Stack SaaS API Builder

This guide covers different deployment strategies for the PERN Stack SaaS Multi-Tenant API Builder.

## 📋 Prerequisites

### System Requirements
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Node.js**: 18+ (for local development)
- **PostgreSQL**: 15+ (if running locally)
- **Redis**: 7+ (for caching)

### For Kubernetes Deployment
- **Kubernetes**: 1.25+
- **kubectl**: Configured and connected to your cluster
- **Helm**: 3.0+ (optional, for package management)

## 🔧 Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Mj26111999/pern-saas-api-builder.git
cd pern-saas-api-builder
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit the environment file
nano .env
```

**Required Environment Variables:**
```env
# Database
DB_PASSWORD=your_secure_password_here
JWT_SECRET=your_super_secret_jwt_key_here

# Optional but recommended
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## 🐳 Docker Deployment

### Development Environment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services Available:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Database**: localhost:5432
- **Redis**: localhost:6379

### Production Environment
```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# With monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# With logging stack
docker-compose -f docker-compose.prod.yml --profile logging up -d

# Full stack with all services
docker-compose -f docker-compose.prod.yml --profile monitoring --profile logging --profile backup up -d
```

**Production Services:**
- **Application**: http://localhost (via Nginx)
- **API**: http://localhost/api
- **Monitoring**: http://localhost:3001 (Grafana)
- **Metrics**: http://localhost:9090 (Prometheus)
- **Logs**: http://localhost:5601 (Kibana)

## ☸️ Kubernetes Deployment

### 1. Prepare Kubernetes Cluster
```bash
# Create namespace
kubectl create namespace pern-api-builder

# Set default namespace
kubectl config set-context --current --namespace=pern-api-builder
```

### 2. Configure Secrets
```bash
# Create database secret
kubectl create secret generic postgres-secret \
  --from-literal=username=postgres \
  --from-literal=password=your_secure_password

# Create JWT secret
kubectl create secret generic jwt-secret \
  --from-literal=secret=your_super_secret_jwt_key

# Create TLS secret (if you have SSL certificates)
kubectl create secret tls api-builder-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

### 3. Deploy Application
```bash
# Apply all configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods
kubectl get services
kubectl get ingress

# View logs
kubectl logs -f deployment/backend-deployment
kubectl logs -f deployment/frontend-deployment
```

### 4. Scale Application
```bash
# Manual scaling
kubectl scale deployment backend-deployment --replicas=5
kubectl scale deployment frontend-deployment --replicas=3

# Auto-scaling is configured via HPA (Horizontal Pod Autoscaler)
kubectl get hpa
```

## 🌐 Cloud Provider Deployment

### AWS EKS
```bash
# Create EKS cluster
eksctl create cluster --name api-builder --region us-west-2 --nodes 3

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name api-builder

# Deploy application
kubectl apply -f k8s/
```

### Google GKE
```bash
# Create GKE cluster
gcloud container clusters create api-builder \
  --zone us-central1-a \
  --num-nodes 3

# Get credentials
gcloud container clusters get-credentials api-builder --zone us-central1-a

# Deploy application
kubectl apply -f k8s/
```

### Azure AKS
```bash
# Create AKS cluster
az aks create \
  --resource-group myResourceGroup \
  --name api-builder \
  --node-count 3 \
  --enable-addons monitoring

# Get credentials
az aks get-credentials --resource-group myResourceGroup --name api-builder

# Deploy application
kubectl apply -f k8s/
```

## 🔒 SSL/TLS Configuration

### Using Let's Encrypt with cert-manager
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## 📊 Monitoring Setup

### Prometheus + Grafana
```bash
# Deploy with monitoring profile
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Access Grafana
open http://localhost:3001
# Default credentials: admin/admin
```

### Custom Metrics
The application exposes metrics at `/metrics` endpoint:
- Request count and duration
- Database connection pool status
- WebSocket connections
- API usage by tenant

## 📝 Logging Configuration

### ELK Stack
```bash
# Deploy with logging profile
docker-compose -f docker-compose.prod.yml --profile logging up -d

# Access Kibana
open http://localhost:5601
```

### Log Levels
Configure via environment variable:
```env
LOG_LEVEL=info  # debug, info, warn, error
```

## 🔄 Backup and Recovery

### Database Backup
```bash
# Manual backup
docker exec pern-api-builder-db-prod pg_dump -U postgres api_builder > backup.sql

# Automated backup (included in production compose)
docker-compose -f docker-compose.prod.yml --profile backup up -d
```

### Restore Database
```bash
# Restore from backup
docker exec -i pern-api-builder-db-prod psql -U postgres api_builder < backup.sql
```

## 🚀 CI/CD Pipeline

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build and push Docker images
      run: |
        docker build -t ${{ secrets.REGISTRY }}/backend:${{ github.sha }} ./backend
        docker build -t ${{ secrets.REGISTRY }}/frontend:${{ github.sha }} ./frontend
        docker push ${{ secrets.REGISTRY }}/backend:${{ github.sha }}
        docker push ${{ secrets.REGISTRY }}/frontend:${{ github.sha }}
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/backend-deployment backend=${{ secrets.REGISTRY }}/backend:${{ github.sha }}
        kubectl set image deployment/frontend-deployment frontend=${{ secrets.REGISTRY }}/frontend:${{ github.sha }}
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database status
docker-compose logs postgres

# Test connection
docker exec -it pern-api-builder-db-prod psql -U postgres -d api_builder
```

#### Backend Service Not Starting
```bash
# Check backend logs
docker-compose logs backend

# Common issues:
# - Missing environment variables
# - Database not ready
# - Port conflicts
```

#### Frontend Build Errors
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend --no-cache
```

### Health Checks
```bash
# Application health
curl http://localhost:5000/health

# Database health
docker exec pern-api-builder-db-prod pg_isready -U postgres

# Redis health
docker exec pern-api-builder-redis-prod redis-cli ping
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_api_usage_logs_tenant_created 
ON api_usage_logs(tenant_id, created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM api_endpoints WHERE tenant_id = 'uuid';
```

### Application Scaling
```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Kubernetes auto-scaling
kubectl autoscale deployment backend-deployment --cpu-percent=70 --min=3 --max=10
```

## 🔐 Security Checklist

- [ ] Change default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Enable database encryption
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] API key rotation
- [ ] Access logging

## 📞 Support

### Getting Help
- **Documentation**: [GitHub Wiki](https://github.com/Mj26111999/pern-saas-api-builder/wiki)
- **Issues**: [GitHub Issues](https://github.com/Mj26111999/pern-saas-api-builder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Mj26111999/pern-saas-api-builder/discussions)

### Monitoring and Alerts
Set up alerts for:
- High CPU/Memory usage
- Database connection failures
- API response time degradation
- Disk space usage
- Failed authentication attempts

---

**🎉 Congratulations! Your PERN Stack SaaS API Builder is now deployed and ready to serve your users!**