---
title: Getting Started with Fluid Topics
author: Documentation Team
tags: [getting-started, quickstart, tutorial]
product: Fluid Topics
version: "1.0"
---

# Getting Started with Fluid Topics

Welcome to Fluid Topics, your dynamic content delivery platform. This guide will help you get up and running quickly.

## Installation

To install Fluid Topics, follow these steps:

1. Clone the repository
2. Install dependencies with `npm install`
3. Configure your environment variables
4. Start the development server

### System Requirements

- Node.js 18 or higher
- MongoDB 7.0+
- Elasticsearch 8.x
- Docker (optional, for local development)

## Configuration

Fluid Topics uses environment variables for configuration. Create a `.env` file in the project root:

```
MONGODB_URI=your_mongodb_connection_string
ELASTICSEARCH_URL=http://localhost:9200
JWT_SECRET=your_secret_key
```

### Database Setup

MongoDB stores all your content, user data, and analytics. You can use MongoDB Atlas for cloud hosting or run a local instance.

### Search Engine Setup

Elasticsearch powers the full-text search capabilities. It indexes all your topics for fast retrieval with features like:

- Full-text search with BM25 scoring
- Faceted filtering by tags, products, and versions
- Auto-complete suggestions
- Search result highlighting

## Content Ingestion

Upload your documents through the admin dashboard or use the REST API.

### Supported Formats

| Format | Extension | Parser |
|--------|-----------|--------|
| HTML | .html, .htm | Cheerio |
| Markdown | .md | Marked |
| DOCX | .docx | Mammoth |
| XML/DITA | .xml | xml2js |
| ZIP | .zip | adm-zip |

### API Ingestion

You can also ingest content programmatically:

```javascript
const formData = new FormData();
formData.append('file', yourFile);

fetch('/api/ingest/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
  body: formData
});
```

## Search Features

Fluid Topics provides powerful search capabilities:

- **Full-text search**: Find content using natural language queries
- **Faceted filtering**: Narrow results by tags, product, version
- **Auto-suggestions**: Get real-time search suggestions as you type
- **Related content**: Discover related topics automatically

## Analytics

Track how users interact with your content:

- Search queries and success rates
- Page views and engagement metrics
- Failed searches (to identify content gaps)
- Daily trend analysis

## API Reference

The platform exposes RESTful APIs for integration:

- `GET /api/search?q=query` — Search topics
- `GET /api/topics/:id` — Get topic by ID
- `GET /api/topics/popular` — Popular topics
- `POST /api/ingest/upload` — Upload content
- `GET /api/analytics/dashboard` — Analytics data
