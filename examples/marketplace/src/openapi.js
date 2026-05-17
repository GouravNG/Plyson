// OpenAPI 3.1 spec builder for /openapi.json.

export function buildOpenAPISpec(host, version = "3.0.0") {
  // Shared schema components
  const schemas = {
    Error: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        error: { type: "string" },
      },
    },
    ValidationError: {
      allOf: [{ $ref: "#/components/schemas/Error" }, {
        type: "object",
        properties: { errors: { type: "array", items: { type: "string" } } },
      }],
    },
    User: {
      type: "object",
      properties: {
        id: { type: "string" }, email: { type: "string", format: "email" },
        firstname: { type: "string" }, lastname: { type: "string" },
        role: { type: "string", enum: ["ADMIN", "USER"] },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        deletedAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    LoginResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string" },
        token: { type: "string" },
        expiresAt: { type: "string", format: "date-time" },
        user: { $ref: "#/components/schemas/User" },
      },
    },
    Business: {
      type: "object",
      properties: {
        id: { type: "string" }, name: { type: "string" },
        email: { type: "string" }, phone: { type: "string" }, address: { type: "string" },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, deletedAt: { type: "string", nullable: true },
      },
    },
    Store: {
      type: "object",
      properties: {
        id: { type: "string" }, name: { type: "string" }, businessId: { type: "string", nullable: true },
        location: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, deletedAt: { type: "string", nullable: true },
      },
    },
    Service: {
      type: "object",
      properties: {
        id: { type: "string" }, name: { type: "string" },
        description: { type: "string", nullable: true }, price: { type: "number", nullable: true },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, deletedAt: { type: "string", nullable: true },
      },
    },
    CartItem: {
      type: "object",
      properties: {
        serviceId: { type: "string" }, qty: { type: "integer", minimum: 1 },
        addedAt: { type: "string", format: "date-time" },
        service: { $ref: "#/components/schemas/Service" },
      },
    },
    Cart: {
      type: "object",
      properties: {
        id: { type: "string" }, userId: { type: "string" },
        items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
        subtotal: { type: "number" },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
      },
    },
    OrderItem: {
      type: "object",
      properties: {
        serviceId: { type: "string" }, serviceName: { type: "string" },
        price: { type: "number" }, qty: { type: "integer" }, lineTotal: { type: "number" },
      },
    },
    Order: {
      type: "object",
      properties: {
        id: { type: "string" }, userId: { type: "string" },
        items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
        subtotal: { type: "number" },
        status: { type: "string", enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] },
        statusHistory: { type: "array", items: { type: "object" } },
        shippingAddress: { type: "string", nullable: true },
        note: { type: "string", nullable: true },
        cancelReason: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
      },
    },
    Review: {
      type: "object",
      properties: {
        id: { type: "string" }, userId: { type: "string" }, serviceId: { type: "string" }, orderId: { type: "string" },
        rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string", nullable: true },
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
        moderationNote: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
      },
    },
    Notification: {
      type: "object",
      properties: {
        id: { type: "string" }, userId: { type: "string" },
        type: { type: "string", enum: ["AUTH", "ORDER", "REVIEW", "BROADCAST"] },
        title: { type: "string" }, body: { type: "string" },
        read: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    Pagination: {
      type: "object",
      properties: {
        page: { type: "integer" }, limit: { type: "integer" },
        total: { type: "integer" }, pages: { type: "integer" },
      },
    },
  };

  const bearer = { BearerAuth: [] };
  const p401 = { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  const p403 = { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  const p404 = { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  const p422 = { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } };
  const jsonOk = (desc, schemaRef) => ({ description: desc, content: { "application/json": { schema: schemaRef ? { $ref: schemaRef } : { type: "object" } } } });

  const pageQP = [
    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
    { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
  ];

  return {
    openapi: "3.1.0",
    info: {
      title: "Mock API Server",
      version,
      description: "Full-featured mock REST API — auth, users, foundation, cart, orders, reviews, notifications. Pure Node.js, zero external deps.",
      contact: { name: "Mock API" },
    },
    servers: [{ url: `http://${host}`, description: "Local dev server" }],
    components: {
      schemas,
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque", description: "Obtain token from POST /auth/login" },
      },
    },
    tags: [
      { name: "Auth", description: "Registration, login, session management" },
      { name: "User", description: "Own profile management (USER role)" },
      { name: "Foundation", description: "Business, store, service catalogue (ADMIN role)" },
      { name: "Cart", description: "Shopping cart (USER role)" },
      { name: "Orders", description: "Order lifecycle" },
      { name: "Reviews", description: "Service reviews with moderation" },
      { name: "Notification", description: "In-app notification inbox" },
      { name: "Utility", description: "Health, diagnostics, API spec" },
    ],
    paths: {
      // ── AUTH ──────────────────────────────────────────────────────────────
      "/auth/register": {
        post: {
          tags: ["Auth"], summary: "Register a new user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password", "firstname", "lastname"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 6 }, firstname: { type: "string" }, lastname: { type: "string" }, role: { type: "string", enum: ["ADMIN", "USER"], default: "USER" } } } } } },
          responses: { 201: jsonOk("Registered", "#/components/schemas/User"), 409: { description: "Email taken" }, 422: p422 },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"], summary: "Login and receive a Bearer token",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } } },
          responses: { 200: jsonOk("Token", "#/components/schemas/LoginResponse"), 401: p401, 422: p422 },
        },
      },
      "/auth/logout": {
        post: { tags: ["Auth"], summary: "Invalidate current token", security: [bearer], responses: { 200: jsonOk("Logged out"), 401: p401 } },
      },
      "/auth/me": {
        get: { tags: ["Auth"], summary: "Get own profile from token", security: [bearer], responses: { 200: jsonOk("Own profile", "#/components/schemas/User"), 401: p401 } },
      },
      "/auth/refresh": {
        post: { tags: ["Auth"], summary: "Extend token TTL without re-login", security: [bearer], responses: { 200: jsonOk("Token refreshed"), 401: p401 } },
      },
      // ── USER ──────────────────────────────────────────────────────────────
      "/user": {
        get: { tags: ["User"], summary: "Get own profile", security: [bearer], responses: { 200: jsonOk("Profile", "#/components/schemas/User"), 401: p401, 403: p403 } },
        post: { tags: ["User"], summary: "Create a user account", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } }, responses: { 201: jsonOk("Created", "#/components/schemas/User"), 401: p401, 403: p403, 409: { description: "Email taken" }, 422: p422 } },
        patch: { tags: ["User"], summary: "Update own profile", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { firstname: { type: "string" }, lastname: { type: "string" }, password: { type: "string", minLength: 6 } } } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/User"), 401: p401, 403: p403, 422: p422 } },
        delete: { tags: ["User"], summary: "Soft-delete own account", security: [bearer], responses: { 200: jsonOk("Deactivated"), 401: p401, 403: p403 } },
      },
      // ── FOUNDATION ────────────────────────────────────────────────────────
      "/foundation/business": {
        get: { tags: ["Foundation"], summary: "List businesses", security: [bearer], parameters: [...pageQP, { name: "includeDeleted", in: "query", schema: { type: "boolean" } }], responses: { 200: jsonOk("List"), 401: p401, 403: p403 } },
        post: { tags: ["Foundation"], summary: "Create business", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" } } } } } }, responses: { 201: jsonOk("Created", "#/components/schemas/Business"), 401: p401, 403: p403, 422: p422 } },
      },
      "/foundation/business/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Foundation"], summary: "Get business", security: [bearer], responses: { 200: jsonOk("Business", "#/components/schemas/Business"), 401: p401, 403: p403, 404: p404 } },
        patch: { tags: ["Foundation"], summary: "Update business", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Business" } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/Business"), 401: p401, 403: p403, 404: p404 } },
        delete: { tags: ["Foundation"], summary: "Soft-delete business", security: [bearer], responses: { 200: jsonOk("Deleted"), 401: p401, 403: p403, 404: p404 } },
      },
      "/foundation/store": {
        get: { tags: ["Foundation"], summary: "List stores", security: [bearer], parameters: pageQP, responses: { 200: jsonOk("List"), 401: p401, 403: p403 } },
        post: { tags: ["Foundation"], summary: "Create store", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, businessId: { type: "string" }, location: { type: "string" } } } } } }, responses: { 201: jsonOk("Created", "#/components/schemas/Store"), 401: p401, 403: p403, 422: p422 } },
      },
      "/foundation/store/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Foundation"], summary: "Get store", security: [bearer], responses: { 200: jsonOk("Store", "#/components/schemas/Store"), 401: p401, 403: p403, 404: p404 } },
        patch: { tags: ["Foundation"], summary: "Update store", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Store" } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/Store"), 401: p401, 403: p403, 404: p404 } },
        delete: { tags: ["Foundation"], summary: "Soft-delete store", security: [bearer], responses: { 200: jsonOk("Deleted"), 401: p401, 403: p403, 404: p404 } },
      },
      "/foundation/services": {
        get: { tags: ["Foundation"], summary: "List services", security: [bearer], parameters: pageQP, responses: { 200: jsonOk("List"), 401: p401, 403: p403 } },
        post: { tags: ["Foundation"], summary: "Create service", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" }, price: { type: "number" } } } } } }, responses: { 201: jsonOk("Created", "#/components/schemas/Service"), 401: p401, 403: p403, 422: p422 } },
      },
      "/foundation/services/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Foundation"], summary: "Get service", security: [bearer], responses: { 200: jsonOk("Service", "#/components/schemas/Service"), 401: p401, 403: p403, 404: p404 } },
        patch: { tags: ["Foundation"], summary: "Update service", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Service" } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/Service"), 401: p401, 403: p403, 404: p404 } },
        delete: { tags: ["Foundation"], summary: "Soft-delete service", security: [bearer], responses: { 200: jsonOk("Deleted"), 401: p401, 403: p403, 404: p404 } },
      },
      "/foundation/association/{storeId}": {
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Foundation"], summary: "List services for a store", security: [bearer], responses: { 200: jsonOk("Services list"), 401: p401, 403: p403, 404: p404 } },
        post: { tags: ["Foundation"], summary: "Associate a service with a store (or create inline)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { serviceId: { type: "string" }, name: { type: "string" }, description: { type: "string" }, price: { type: "number" } } } } } }, responses: { 201: jsonOk("Associated"), 401: p401, 403: p403, 404: p404, 409: { description: "Already associated" }, 422: p422 } },
      },
      "/foundation/association/{storeId}/{serviceId}": {
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }, { name: "serviceId", in: "path", required: true, schema: { type: "string" } }],
        delete: { tags: ["Foundation"], summary: "Remove association", security: [bearer], responses: { 200: jsonOk("Removed"), 401: p401, 403: p403, 404: p404 } },
      },
      // ── CART ──────────────────────────────────────────────────────────────
      "/cart": {
        get: { tags: ["Cart"], summary: "Get own cart (auto-created)", security: [bearer], responses: { 200: jsonOk("Cart", "#/components/schemas/Cart"), 401: p401, 403: p403 } },
        post: { tags: ["Cart"], summary: "Add item to cart", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["serviceId"], properties: { serviceId: { type: "string" }, qty: { type: "integer", default: 1 } } } } } }, responses: { 200: jsonOk("Cart", "#/components/schemas/Cart"), 401: p401, 403: p403, 404: p404, 422: p422 } },
        patch: { tags: ["Cart"], summary: "Set item qty (0 = remove)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["serviceId", "qty"], properties: { serviceId: { type: "string" }, qty: { type: "integer", minimum: 0 } } } } } }, responses: { 200: jsonOk("Cart", "#/components/schemas/Cart"), 401: p401, 403: p403, 404: p404, 422: p422 } },
        delete: { tags: ["Cart"], summary: "Remove one item or clear cart", security: [bearer], requestBody: { content: { "application/json": { schema: { type: "object", properties: { serviceId: { type: "string", description: "Omit to clear entire cart" } } } } } }, responses: { 200: jsonOk("Cart", "#/components/schemas/Cart"), 401: p401, 403: p403 } },
      },
      // ── ORDERS ────────────────────────────────────────────────────────────
      "/orders": {
        post: { tags: ["Orders"], summary: "Checkout cart → new order", security: [bearer], requestBody: { content: { "application/json": { schema: { type: "object", properties: { shippingAddress: { type: "string" }, note: { type: "string" } } } } } }, responses: { 201: jsonOk("Order created", "#/components/schemas/Order"), 400: { description: "Cart empty" }, 401: p401, 403: p403 } },
        get: { tags: ["Orders"], summary: "List orders — own (USER) or all (ADMIN)", security: [bearer], parameters: [...pageQP, { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] } }, { name: "userId", in: "query", schema: { type: "string" }, description: "ADMIN only" }], responses: { 200: jsonOk("Orders list"), 401: p401 } },
      },
      "/orders/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Orders"], summary: "Get order detail", security: [bearer], responses: { 200: jsonOk("Order", "#/components/schemas/Order"), 401: p401, 403: p403, 404: p404 } },
      },
      "/orders/{id}/cancel": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        post: { tags: ["Orders"], summary: "Cancel own order (USER) — only from PENDING/CONFIRMED/PROCESSING", security: [bearer], requestBody: { content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string" } } } } } }, responses: { 200: jsonOk("Cancelled", "#/components/schemas/Order"), 401: p401, 403: p403, 404: p404, 409: { description: "Cannot cancel in current status" } } },
      },
      "/orders/{id}/status": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        patch: { tags: ["Orders"], summary: "Advance order status (ADMIN)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] }, note: { type: "string" } } } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/Order"), 400: { description: "Invalid status" }, 401: p401, 403: p403, 404: p404, 409: { description: "Illegal transition" } } },
      },
      // ── REVIEWS ───────────────────────────────────────────────────────────
      "/reviews": {
        post: { tags: ["Reviews"], summary: "Submit a review (USER — must have a DELIVERED order with that service)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["serviceId", "orderId", "rating"], properties: { serviceId: { type: "string" }, orderId: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } } } } }, responses: { 201: jsonOk("Submitted", "#/components/schemas/Review"), 401: p401, 403: p403, 404: p404, 409: { description: "Already reviewed / wrong order status / service not in order" }, 422: p422 } },
        get: { tags: ["Reviews"], summary: "List reviews — APPROVED only (public/USER); all for ADMIN", parameters: [...pageQP, { name: "serviceId", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] }, description: "ADMIN only" }], responses: { 200: jsonOk("Reviews list") } },
      },
      "/reviews/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: { tags: ["Reviews"], summary: "Get review", responses: { 200: jsonOk("Review", "#/components/schemas/Review"), 404: p404 } },
        patch: { tags: ["Reviews"], summary: "Edit own PENDING review (USER)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } } } } }, responses: { 200: jsonOk("Updated", "#/components/schemas/Review"), 401: p401, 403: p403, 404: p404, 409: { description: "Not PENDING" } } },
        delete: { tags: ["Reviews"], summary: "Delete review — own (USER) or any (ADMIN)", security: [bearer], responses: { 200: jsonOk("Deleted"), 401: p401, 403: p403, 404: p404 } },
      },
      "/reviews/{id}/moderate": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        patch: { tags: ["Reviews"], summary: "Approve or reject a review (ADMIN)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["APPROVED", "REJECTED"] }, note: { type: "string" } } } } } }, responses: { 200: jsonOk("Moderated", "#/components/schemas/Review"), 401: p401, 403: p403, 404: p404, 422: p422 } },
      },
      // ── NOTIFICATIONS ─────────────────────────────────────────────────────
      "/notifications": {
        get: { tags: ["Notification"], summary: "List notifications — own (USER) or all (ADMIN)", security: [bearer], parameters: [...pageQP, { name: "read", in: "query", schema: { type: "boolean" } }, { name: "type", in: "query", schema: { type: "string", enum: ["AUTH", "ORDER", "REVIEW", "BROADCAST"] } }, { name: "userId", in: "query", schema: { type: "string" }, description: "ADMIN only" }], responses: { 200: jsonOk("Notifications list"), 401: p401 } },
      },
      "/notifications/{id}/read": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        patch: { tags: ["Notification"], summary: "Mark one notification as read", security: [bearer], responses: { 200: jsonOk("Marked read", "#/components/schemas/Notification"), 401: p401, 404: p404 } },
      },
      "/notifications/read-all": {
        post: { tags: ["Notification"], summary: "Mark all own notifications as read", security: [bearer], responses: { 200: jsonOk("All read"), 401: p401 } },
      },
      "/notifications/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        delete: { tags: ["Notification"], summary: "Delete a notification", security: [bearer], responses: { 200: jsonOk("Deleted"), 401: p401, 404: p404 } },
      },
      "/notifications/broadcast": {
        post: { tags: ["Notification"], summary: "Broadcast to all users or by role (ADMIN)", security: [bearer], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "message"], properties: { title: { type: "string" }, message: { type: "string" }, role: { type: "string", enum: ["ADMIN", "USER"], description: "Omit to send to everyone" } } } } } }, responses: { 200: jsonOk("Broadcast sent"), 401: p401, 403: p403, 422: p422 } },
      },
      // ── UTILITY ───────────────────────────────────────────────────────────
      "/": {
        get: { tags: ["Utility"], summary: "API index — lists all endpoints", responses: { 200: jsonOk("Index") } },
      },
      "/health": {
        get: { tags: ["Utility"], summary: "Server health + DB stats (ADMIN)", security: [bearer], responses: { 200: jsonOk("Health"), 401: p401, 403: p403 } },
      },
      "/cache-clear": {
        post: { tags: ["Utility"], summary: "Invalidate all sessions (ADMIN)", security: [bearer], responses: { 200: jsonOk("Cleared"), 401: p401, 403: p403 } },
      },
      "/db-snapshot": {
        get: { tags: ["Utility"], summary: "Full in-memory DB dump — dev only (ADMIN)", security: [bearer], responses: { 200: jsonOk("Snapshot"), 401: p401, 403: p403 } },
      },
      "/openapi.json": {
        get: { tags: ["Utility"], summary: "OpenAPI 3.1 spec (this document)", responses: { 200: jsonOk("OpenAPI spec") } },
      },
      "/docs": {
        get: { tags: ["Utility"], summary: "Swagger UI — interactive browser docs", responses: { 200: { description: "HTML page" } } },
      },
    },
  };
}
