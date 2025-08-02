-- Multi-tenant SaaS API Builder Database Schema
-- PostgreSQL 15+ compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
    max_endpoints INTEGER DEFAULT 10,
    max_requests_per_day INTEGER DEFAULT 10000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Database connections table
CREATE TABLE database_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    db_type VARCHAR(50) NOT NULL CHECK (db_type IN ('postgresql', 'mysql', 'mongodb', 'redis', 'sqlite')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    ssl_enabled BOOLEAN DEFAULT false,
    connection_params JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    test_result JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API endpoints table
CREATE TABLE api_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    database_connection_id UUID REFERENCES database_connections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    path VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    query_template TEXT NOT NULL,
    parameters JSONB DEFAULT '[]',
    response_format JSONB DEFAULT '{}',
    authentication_required BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 100,
    cache_ttl INTEGER DEFAULT 0, -- seconds
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '1.0.0',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, path, method)
);

-- Generated APIs table
CREATE TABLE generated_apis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint_id UUID REFERENCES api_endpoints(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL CHECK (language IN ('python', 'nodejs', 'go', 'java', 'php', 'ruby', 'csharp')),
    framework VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    dockerfile TEXT,
    requirements TEXT,
    deployment_url VARCHAR(500),
    version VARCHAR(20) DEFAULT '1.0.0',
    is_deployed BOOLEAN DEFAULT false,
    deployment_status VARCHAR(50) DEFAULT 'pending',
    build_logs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API usage logs table
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint_id UUID REFERENCES api_endpoints(id) ON DELETE CASCADE,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_headers JSONB DEFAULT '{}',
    request_body JSONB DEFAULT '{}',
    response_status INTEGER,
    response_time_ms INTEGER,
    response_size_bytes INTEGER,
    ip_address INET,
    user_agent TEXT,
    api_key_used VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Real-time connections table (for WebSocket management)
CREATE TABLE realtime_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    socket_id VARCHAR(255) NOT NULL,
    user_info JSONB DEFAULT '{}',
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- API keys table (for additional API key management)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}',
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint_id UUID REFERENCES api_endpoints(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events TEXT[] DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_api_key ON tenants(api_key);
CREATE INDEX idx_tenants_plan ON tenants(plan);

CREATE INDEX idx_database_connections_tenant_id ON database_connections(tenant_id);
CREATE INDEX idx_database_connections_type ON database_connections(db_type);
CREATE INDEX idx_database_connections_active ON database_connections(is_active);

CREATE INDEX idx_api_endpoints_tenant_id ON api_endpoints(tenant_id);
CREATE INDEX idx_api_endpoints_path_method ON api_endpoints(path, method);
CREATE INDEX idx_api_endpoints_active ON api_endpoints(is_active);
CREATE INDEX idx_api_endpoints_connection_id ON api_endpoints(database_connection_id);

CREATE INDEX idx_generated_apis_tenant_id ON generated_apis(tenant_id);
CREATE INDEX idx_generated_apis_endpoint_id ON generated_apis(endpoint_id);
CREATE INDEX idx_generated_apis_language ON generated_apis(language);

CREATE INDEX idx_api_usage_logs_tenant_id ON api_usage_logs(tenant_id);
CREATE INDEX idx_api_usage_logs_endpoint_id ON api_usage_logs(endpoint_id);
CREATE INDEX idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_logs_status ON api_usage_logs(response_status);

CREATE INDEX idx_realtime_connections_tenant_id ON realtime_connections(tenant_id);
CREATE INDEX idx_realtime_connections_active ON realtime_connections(is_active);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key ON api_keys(api_key);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_database_connections_updated_at BEFORE UPDATE ON database_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_endpoints_updated_at BEFORE UPDATE ON api_endpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generated_apis_updated_at BEFORE UPDATE ON generated_apis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for development
INSERT INTO tenants (name, subdomain, api_key, plan, max_endpoints, max_requests_per_day) VALUES
('Demo Company', 'demo', 'api_demo_12345678901234567890', 'pro', 100, 100000),
('Startup Inc', 'startup', 'api_startup_09876543210987654321', 'basic', 10, 10000);

-- Views for analytics
CREATE VIEW tenant_usage_summary AS
SELECT 
    t.id,
    t.name,
    t.plan,
    COUNT(DISTINCT dc.id) as database_connections,
    COUNT(DISTINCT ae.id) as api_endpoints,
    COUNT(DISTINCT ga.id) as generated_apis,
    COALESCE(daily_requests.request_count, 0) as requests_today
FROM tenants t
LEFT JOIN database_connections dc ON t.id = dc.tenant_id AND dc.is_active = true
LEFT JOIN api_endpoints ae ON t.id = ae.tenant_id AND ae.is_active = true
LEFT JOIN generated_apis ga ON t.id = ga.tenant_id
LEFT JOIN (
    SELECT 
        tenant_id,
        COUNT(*) as request_count
    FROM api_usage_logs 
    WHERE created_at >= CURRENT_DATE
    GROUP BY tenant_id
) daily_requests ON t.id = daily_requests.tenant_id
WHERE t.is_active = true
GROUP BY t.id, t.name, t.plan, daily_requests.request_count;

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key(prefix TEXT DEFAULT 'api')
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to encrypt passwords
CREATE OR REPLACE FUNCTION encrypt_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql;

-- Function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, encrypted_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN encrypted_password = crypt(password, encrypted_password);
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE api_builder IS 'Multi-tenant SaaS API Builder database';
COMMENT ON TABLE tenants IS 'Tenant organizations using the API builder platform';
COMMENT ON TABLE database_connections IS 'Database connections configured by tenants';
COMMENT ON TABLE api_endpoints IS 'API endpoints created by tenants';
COMMENT ON TABLE generated_apis IS 'Generated API code in various languages';
COMMENT ON TABLE api_usage_logs IS 'Usage logs for API endpoints';
COMMENT ON TABLE realtime_connections IS 'Active WebSocket connections';
COMMENT ON TABLE api_keys IS 'API keys for authentication';
COMMENT ON TABLE webhooks IS 'Webhook configurations for endpoints';