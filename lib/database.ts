/**
 * SQLite database infrastructure for Willys MCP server
 * Handles sessions, order cache, and other persistent storage needs
 */

// Dynamic imports to avoid Next.js bundling issues
let Database: any;
let sqliteVec: any;

// Only import embeddings when needed
async function getEmbeddingUtils() {
  return await import("./embeddings");
}

class WillysDatabase {
  private db: any;
  public initialized: boolean = false;
  private vectorSupport: boolean = false;

  async ensureInitialized() {
    if (this.initialized) {
      console.log("Database already initialized, skipping...");
      return;
    }

    // Check if we're in a Node.js environment
    if (typeof process === "undefined" || !process.versions?.node) {
      throw new Error("Database operations require Node.js environment");
    }

    try {
      // Dynamic imports to avoid loading in browser
      Database = (await import("better-sqlite3")).default;

      // Load sqlite-vec with dynamic import to avoid Next.js bundler issues
      // Use Function constructor to prevent bundler from statically analyzing the import
      try {
        const dynamicImport = new Function("module", "return import(module)");
        sqliteVec = await dynamicImport("sqlite-vec-darwin-arm64");
      } catch (_e) {
        sqliteVec = await import("sqlite-vec");
      }

      // Get current working directory
      const cwdString = process.cwd();

      // Use require('path') to avoid ESM import issues
      const path = require("node:path");

      // Use path.resolve to ensure we get an absolute path string
      const DB_PATH = path.resolve(cwdString, "willys-cache.db");

      // Ensure DB_PATH is definitely a string (not a URL object)
      const dbPathString = String(DB_PATH);
      this.db = new Database(dbPathString);
      console.log("Database created successfully");

      this.db.pragma("journal_mode = WAL"); // Better performance for concurrent access
      this.db.pragma("synchronous = NORMAL"); // Good balance of safety and performance
      console.log("Database pragmas set");

      // Load sqlite-vec extension for vector operations
      console.log("Loading sqlite-vec extension...");
      try {
        // Ensure we're passing the database instance correctly
        if (
          typeof sqliteVec.load === "function" &&
          this.db &&
          typeof this.db.prepare === "function"
        ) {
          console.log("sqlite-vec available methods:", Object.keys(sqliteVec));

          // Use multiple approaches to load sqlite-vec extension
          let extensionLoaded = false;

          // Approach 1: Try getLoadablePath if available
          if (typeof sqliteVec.getLoadablePath === "function") {
            try {
              const extensionPath = sqliteVec.getLoadablePath();
              console.log(
                "Loading sqlite-vec from getLoadablePath:",
                extensionPath,
              );
              console.log(
                "File exists check:",
                require("node:fs").existsSync(extensionPath),
              );
              this.db.loadExtension(extensionPath);
              extensionLoaded = true;
              console.log("sqlite-vec loaded successfully via getLoadablePath");
            } catch (pathError) {
              console.log(
                "getLoadablePath approach failed:",
                pathError instanceof Error
                  ? pathError.message
                  : String(pathError),
              );
            }
          }

          // Approach 2: Manual path construction for Next.js compatibility
          if (!extensionLoaded) {
            try {
              console.log("Trying manual path construction...");
              const path = require("node:path");
              const fs = require("node:fs");

              // Construct path manually - this works in both Node.js and Next.js
              const cwd = process.cwd();
              const manualPath = path.join(
                cwd,
                "node_modules",
                "sqlite-vec-darwin-arm64",
                "vec0.dylib",
              );
              console.log("Manual extension path:", manualPath);
              console.log("Manual path exists:", fs.existsSync(manualPath));

              if (fs.existsSync(manualPath)) {
                this.db.loadExtension(manualPath);
                extensionLoaded = true;
                console.log("sqlite-vec loaded successfully via manual path");
              } else {
                console.log(
                  "Manual path does not exist, trying generic sqlite-vec path...",
                );
                const genericPath = path.join(
                  cwd,
                  "node_modules",
                  "sqlite-vec-darwin-arm64",
                  "vec0.dylib",
                );
                if (fs.existsSync(genericPath)) {
                  this.db.loadExtension(genericPath);
                  extensionLoaded = true;
                  console.log(
                    "sqlite-vec loaded successfully via generic path",
                  );
                }
              }
            } catch (manualError) {
              console.log(
                "Manual path approach failed:",
                manualError instanceof Error
                  ? manualError.message
                  : String(manualError),
              );
            }
          }

          // Approach 3: Direct load method as last resort
          if (!extensionLoaded) {
            try {
              console.log("Trying direct sqliteVec.load method...");
              sqliteVec.load(this.db);
              extensionLoaded = true;
              console.log("sqlite-vec loaded successfully via direct load");
            } catch (directError) {
              console.log(
                "Direct load approach failed:",
                directError instanceof Error
                  ? directError.message
                  : String(directError),
              );
            }
          }

          if (extensionLoaded) {
            this.vectorSupport = true;
            console.log("✅ sqlite-vec extension loaded successfully");
          } else {
            this.vectorSupport = false;
            console.log(
              "❌ Failed to load sqlite-vec extension with all approaches",
            );
          }
        } else {
          console.warn(
            "sqlite-vec loading skipped - invalid database instance or load function",
          );
          console.warn("Details:", {
            loadFunctionExists: typeof sqliteVec.load === "function",
            dbExists: !!this.db,
            dbPrepareExists: !!(
              this.db && typeof this.db.prepare === "function"
            ),
          });
        }
      } catch (error) {
        console.error(
          "Failed to load sqlite-vec, continuing without vector support:",
          error instanceof Error ? error.message : String(error),
        );
        this.vectorSupport = false;
        // Continue without vector search capability
      }

      await this.initializeSchema();
      this.startCleanupTimer();
      this.initialized = true;
      console.log("Database initialization completed");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      const err = error as NodeJS.ErrnoException;
      console.error("Error details:", {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error),
        code: err?.code,
        stack:
          error instanceof Error
            ? error.stack?.split("\n").slice(0, 5)
            : undefined,
      });
      throw error;
    }
  }

  private async initializeSchema() {
    // Check if we need to migrate the order_cache table
    this.migrateOrderCacheTable();

    // Check if we need to migrate the products table for vector support
    this.migrateProductsTable();

    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        cookies TEXT NOT NULL,
        authenticated BOOLEAN NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    // Create legacy order cache table (for backward compatibility)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_cache (
        order_number TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        order_details TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    // Create new relational schema
    this.createRelationalSchema();

    // Create vector search schema
    this.createVectorSchema();

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_order_cache_expires ON order_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_order_cache_session ON order_cache(session_id);
    `);

    console.log("Database schema initialized successfully");

    // Run migration if needed
    if (this.needsMigration()) {
      console.log("Detected existing cache data, running migration...");
      const result = this.migrateExistingCacheToRelational();
      console.log(
        `Migration completed: ${result.migrated} orders, ${result.errors} errors`,
      );
    }

    // Check if embedding migration is needed
    if (this.needsEmbeddingMigration()) {
      const totalProducts = this.db
        .prepare("SELECT COUNT(*) as count FROM products")
        .get() as any;
      const embeddedProducts = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM products WHERE name_embedding IS NOT NULL",
        )
        .get() as any;
      console.log(
        `Vector embeddings available for ${embeddedProducts.count}/${totalProducts.count} products`,
      );
      console.log(
        "💡 Run generateMissingEmbeddings() to enable full semantic search capabilities",
      );
    }
  }

  private createRelationalSchema() {
    // Enhanced orders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        order_number TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        order_date INTEGER NOT NULL,
        delivery_date TEXT,
        status TEXT,
        total_amount REAL,
        store_name TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        raw_data TEXT
      );
    `);

    // Products master table (deduplicated)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        product_code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        manufacturer TEXT,
        name_normalized TEXT,
        name_embedding BLOB,
        embedding_generated_at INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    // Categories master table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        name_normalized TEXT
      );
    `);

    // Order-Product relationships (purchase history)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL,
        product_code TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        price_value REAL,
        price_formatted TEXT,
        purchased_at INTEGER NOT NULL,
        FOREIGN KEY (order_number) REFERENCES orders(order_number) ON DELETE CASCADE,
        FOREIGN KEY (product_code) REFERENCES products(product_code),
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
      );
    `);

    // Performance indexes for relational schema
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_orders_expires ON orders(expires_at);
      CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON products(name_normalized);
      CREATE INDEX IF NOT EXISTS idx_order_products_purchased_at ON order_products(purchased_at);
      CREATE INDEX IF NOT EXISTS idx_order_products_product_code ON order_products(product_code);
      CREATE INDEX IF NOT EXISTS idx_order_products_order_number ON order_products(order_number);
      CREATE INDEX IF NOT EXISTS idx_categories_name_normalized ON categories(name_normalized);
    `);

    console.log("Relational schema created successfully");
  }

  private createVectorSchema() {
    // Create virtual table for vector similarity search
    // Using 1536 dimensions for OpenAI text-embedding-3-small
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS product_vectors USING vec0(
        product_code TEXT PRIMARY KEY,
        name_embedding float[1536]
      );
    `);

    console.log("Vector schema created successfully");
  }

  private migrateProductsTable() {
    try {
      // Check if products table needs vector columns
      const tableInfo = this.db
        .prepare("PRAGMA table_info(products)")
        .all() as any[];
      const hasEmbeddingColumn = tableInfo.some(
        (col) => col.name === "name_embedding",
      );

      if (!hasEmbeddingColumn) {
        console.log("Adding vector support columns to products table...");

        this.db.exec(`
          ALTER TABLE products ADD COLUMN name_embedding BLOB;
          ALTER TABLE products ADD COLUMN embedding_generated_at INTEGER;
        `);

        console.log("Products table migration completed successfully");
      }
    } catch (error) {
      // Products table might not exist yet, will be created later
      console.log(
        "Products table migration not needed or failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private migrateOrderCacheTable() {
    try {
      // Check if order_cache table exists and has foreign key constraint
      const tableInfo = this.db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='order_cache'",
        )
        .get() as any;

      if (tableInfo?.sql.includes("FOREIGN KEY")) {
        console.log(
          "Migrating order_cache table to remove foreign key constraint...",
        );

        // Backup existing data
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS order_cache_backup AS 
          SELECT * FROM order_cache;
        `);

        // Drop the old table
        this.db.exec("DROP TABLE order_cache;");

        // Recreate without foreign key
        this.db.exec(`
          CREATE TABLE order_cache (
            order_number TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            order_details TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          );
        `);

        // Restore data
        this.db.exec(`
          INSERT INTO order_cache 
          SELECT * FROM order_cache_backup;
        `);

        // Clean up backup
        this.db.exec("DROP TABLE order_cache_backup;");

        console.log("Migration completed successfully");
      }
    } catch (error) {
      console.log(
        "No migration needed or migration failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private startCleanupTimer() {
    // Run cleanup every hour
    setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000,
    );
  }

  // Session management methods
  storeSession(
    sessionId: string,
    cookies: string,
    ttlMs: number = 24 * 60 * 60 * 1000,
  ): void {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions 
      (session_id, cookies, authenticated, created_at, expires_at) 
      VALUES (?, ?, 1, ?, ?)
    `);

    stmt.run(sessionId, cookies, now, expiresAt);
  }

  getSession(
    sessionId: string,
  ): { cookies: string; authenticated: boolean } | null {
    const stmt = this.db.prepare(`
      SELECT cookies, authenticated, expires_at 
      FROM sessions 
      WHERE session_id = ?
    `);

    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    // Check if session has expired
    if (Date.now() > row.expires_at) {
      this.clearSession(sessionId);
      return null;
    }

    return {
      cookies: row.cookies,
      authenticated: Boolean(row.authenticated),
    };
  }

  clearSession(sessionId: string): void {
    // Clear related order cache entries first
    const orderCacheStmt = this.db.prepare(
      "DELETE FROM order_cache WHERE session_id = ?",
    );
    orderCacheStmt.run(sessionId);

    // Then clear the session
    const sessionStmt = this.db.prepare(
      "DELETE FROM sessions WHERE session_id = ?",
    );
    sessionStmt.run(sessionId);
  }

  // Order cache methods
  getCachedOrder(orderNumber: string): any | null {
    const stmt = this.db.prepare(`
      SELECT order_details, expires_at 
      FROM order_cache 
      WHERE order_number = ?
    `);

    const row = stmt.get(orderNumber) as any;
    if (!row) return null;

    // Check if cache entry has expired
    if (Date.now() > row.expires_at) {
      this.clearOrderCache(orderNumber);
      return null;
    }

    try {
      return JSON.parse(row.order_details);
    } catch (error) {
      console.error("Failed to parse cached order details:", error);
      this.clearOrderCache(orderNumber);
      return null;
    }
  }

  setCachedOrder(
    orderNumber: string,
    sessionId: string,
    orderDetails: any,
    ttlMs: number = 24 * 60 * 60 * 1000,
  ): void {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO order_cache 
      (order_number, session_id, order_details, created_at, expires_at) 
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      orderNumber,
      sessionId,
      JSON.stringify(orderDetails),
      now,
      expiresAt,
    );
  }

  clearOrderCache(orderNumber?: string): void {
    if (orderNumber) {
      const stmt = this.db.prepare(
        "DELETE FROM order_cache WHERE order_number = ?",
      );
      stmt.run(orderNumber);
    } else {
      // Clear all order cache
      const stmt = this.db.prepare("DELETE FROM order_cache");
      stmt.run();
    }
  }

  clearOrderCacheBySession(sessionId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM order_cache WHERE session_id = ?",
    );
    stmt.run(sessionId);
  }

  // Cleanup expired records
  cleanup(): void {
    const now = Date.now();

    // Clean up expired sessions
    const sessionsStmt = this.db.prepare(
      "DELETE FROM sessions WHERE expires_at < ?",
    );
    const deletedSessions = sessionsStmt.run(now).changes;

    // Clean up expired order cache entries
    const orderCacheStmt = this.db.prepare(
      "DELETE FROM order_cache WHERE expires_at < ?",
    );
    const deletedOrders = orderCacheStmt.run(now).changes;

    if (deletedSessions > 0 || deletedOrders > 0) {
      console.log(
        `Database cleanup: removed ${deletedSessions} expired sessions and ${deletedOrders} expired order cache entries`,
      );
    }
  }

  // Migration methods
  migrateExistingCacheToRelational(): { migrated: number; errors: number } {
    console.log(
      "Starting migration of existing cache data to relational format...",
    );

    let migrated = 0;
    let errors = 0;

    // Get all order cache entries
    const cacheStmt = this.db.prepare(`
      SELECT order_number, session_id, order_details 
      FROM order_cache 
      WHERE expires_at > ?
    `);

    const cacheEntries = cacheStmt.all(Date.now()) as any[];
    console.log(`Found ${cacheEntries.length} cached orders to migrate`);

    for (const entry of cacheEntries) {
      try {
        const orderData = JSON.parse(entry.order_details);

        // Only migrate if it has product data
        if (orderData.categoryOrderedDeliveredProducts) {
          this.storeOrderRelational(orderData, entry.session_id);
          migrated++;

          if (migrated % 10 === 0) {
            console.log(
              `Migrated ${migrated}/${cacheEntries.length} orders...`,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to migrate order ${entry.order_number}:`, error);
        errors++;
      }
    }

    console.log(
      `Migration completed: ${migrated} orders migrated, ${errors} errors`,
    );
    return { migrated, errors };
  }

  // Check if migration is needed
  private needsMigration(): boolean {
    // Don't call ensureInitialized here to avoid infinite loop
    const cacheCount = this.db
      .prepare("SELECT COUNT(*) as count FROM order_cache WHERE expires_at > ?")
      .get(Date.now()) as any;
    const relationalCount = this.db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE expires_at > ?")
      .get(Date.now()) as any;

    return cacheCount.count > 0 && relationalCount.count === 0;
  }

  // Check if embedding migration is needed
  needsEmbeddingMigration(): boolean {
    // Don't call ensureInitialized here to avoid infinite loop
    // This method should only be called after database is already initialized
    if (!this.initialized || !this.vectorSupport) {
      return false;
    }

    const totalProducts = this.db
      .prepare("SELECT COUNT(*) as count FROM products")
      .get() as any;
    const embeddedProducts = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM products WHERE name_embedding IS NOT NULL",
      )
      .get() as any;

    return (
      totalProducts.count > 0 && embeddedProducts.count < totalProducts.count
    );
  }

  // Generate embeddings for all products that don't have them
  async generateMissingEmbeddings(
    batchSize: number = 50,
  ): Promise<{ processed: number; errors: number }> {
    console.log(
      "Starting embedding generation for products without embeddings...",
    );

    let processed = 0;
    let errors = 0;

    try {
      // Get products without embeddings
      const stmt = this.db.prepare(`
        SELECT product_code, name 
        FROM products 
        WHERE name_embedding IS NULL 
        ORDER BY created_at DESC
      `);

      const products = stmt.all() as Array<{
        product_code: string;
        name: string;
      }>;
      console.log(`Found ${products.length} products needing embeddings`);

      if (products.length === 0) {
        return { processed: 0, errors: 0 };
      }

      // Process in batches
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const productNames = batch.map((p) => p.name);

        try {
          console.log(
            `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${batch.length} products)`,
          );

          const { generateEmbeddingsBatch, embeddingToBlob } =
            await getEmbeddingUtils();
          const embeddings = await generateEmbeddingsBatch(
            productNames,
            batchSize,
          );

          // Store embeddings in database
          const updateStmt = this.db.prepare(`
            UPDATE products 
            SET name_embedding = ?, embedding_generated_at = ?
            WHERE product_code = ?
          `);

          const insertVectorStmt = this.db.prepare(`
            INSERT OR REPLACE INTO product_vectors (product_code, name_embedding)
            VALUES (?, ?)
          `);

          const transaction = this.db.transaction(() => {
            for (let j = 0; j < batch.length; j++) {
              const product = batch[j];
              const embedding = embeddings[j];
              const now = Date.now();
              const blob = embeddingToBlob(embedding);

              // Update products table
              updateStmt.run(blob, now, product.product_code);

              // Insert into vector table (convert to array for vec0)
              const embeddingArray = `[${Array.from(embedding).join(",")}]`;
              insertVectorStmt.run(product.product_code, embeddingArray);
            }
          });

          transaction();
          processed += batch.length;

          console.log(`Processed ${processed}/${products.length} products`);

          // Rate limiting between batches
          if (i + batchSize < products.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error processing batch starting at ${i}:`, error);
          errors += batch.length;
        }
      }

      console.log(
        `Embedding generation completed: ${processed} processed, ${errors} errors`,
      );
    } catch (error) {
      console.error("Error in embedding migration:", error);
      errors++;
    }

    return { processed, errors };
  }

  // Relational data methods
  storeOrderRelational(
    orderData: any,
    sessionId: string,
    ttlMs: number = 24 * 60 * 60 * 1000,
  ): void {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const orderDate = orderData.placed || now;

    // Insert or update order
    const orderStmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders 
      (order_number, session_id, order_date, delivery_date, status, total_amount, store_name, created_at, expires_at, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    orderStmt.run(
      orderData.orderNumber || orderData.code,
      sessionId,
      orderDate,
      orderData.deliveryFormattedDate || null,
      orderData.statusDisplay || null,
      orderData.totalPrice?.value || 0,
      orderData.store || null,
      now,
      expiresAt,
      JSON.stringify(orderData),
    );

    // Process products from categoryOrderedDeliveredProducts
    if (orderData.categoryOrderedDeliveredProducts) {
      this.processOrderProducts(orderData, orderDate);
    }
  }

  private processOrderProducts(orderData: any, orderDate: number): void {
    const orderNumber = orderData.orderNumber || orderData.code;

    // First, remove existing order products (for updates)
    const deleteStmt = this.db.prepare(
      "DELETE FROM order_products WHERE order_number = ?",
    );
    deleteStmt.run(orderNumber);

    Object.entries(orderData.categoryOrderedDeliveredProducts).forEach(
      ([categoryName, products]: [string, any]) => {
        if (!Array.isArray(products)) return;

        // Get or create category
        const categoryId = this.getOrCreateCategory(categoryName);

        products.forEach((product: any) => {
          if (!product.code || !product.name) return;

          // Get or create product
          this.getOrCreateProduct(product);

          // Insert order-product relationship
          const orderProductStmt = this.db.prepare(`
          INSERT INTO order_products 
          (order_number, product_code, category_id, quantity, price_value, price_formatted, purchased_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

          orderProductStmt.run(
            orderNumber,
            product.code,
            categoryId,
            product.quantity || 1,
            this.extractPriceValue(product),
            product.basePrice?.formattedValue ||
              product.totalPrice?.formattedValue ||
              null,
            orderDate,
          );
        });
      },
    );
  }

  private getOrCreateCategory(categoryName: string): number {
    const normalized = categoryName.toLowerCase();

    // Try to get existing category
    const selectStmt = this.db.prepare(
      "SELECT category_id FROM categories WHERE name = ?",
    );
    const existing = selectStmt.get(categoryName) as any;

    if (existing) {
      return existing.category_id;
    }

    // Create new category
    const insertStmt = this.db.prepare(`
      INSERT INTO categories (name, name_normalized) VALUES (?, ?)
    `);

    const result = insertStmt.run(categoryName, normalized);
    return result.lastInsertRowid as number;
  }

  private getOrCreateProduct(product: any): void {
    const now = Date.now();
    const normalized = product.name.toLowerCase();

    // Insert or ignore (don't update existing products)
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO products 
      (product_code, name, manufacturer, name_normalized, name_embedding, embedding_generated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      product.code,
      product.name,
      product.manufacturer || null,
      normalized,
      null, // name_embedding - will be generated in batch later
      null, // embedding_generated_at - will be set when embedding is generated
      now,
    );
  }

  private extractPriceValue(product: any): number | null {
    const priceStr =
      product.basePrice?.formattedValue || product.totalPrice?.formattedValue;
    if (!priceStr) return null;

    // Extract numeric value from "XX kr" format
    const match = priceStr.match(/(\d+(?:,\d+)?)/);
    if (match) {
      return parseFloat(match[1].replace(",", "."));
    }
    return null;
  }

  // Smart search with SQL
  searchProductsSQL(
    searchTerm: string,
    maxResults: number = 5,
  ): Array<{
    productCode: string;
    name: string;
    manufacturer: string | null;
    frequency: number;
    lastPurchased: number;
    recentPurchases: number;
    orderHistory: string[];
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        p.product_code,
        p.name,
        p.manufacturer,
        COUNT(*) as frequency,
        MAX(op.purchased_at) as last_purchased,
        SUM(CASE WHEN op.purchased_at > ? THEN 1 ELSE 0 END) as recent_purchases,
        GROUP_CONCAT(DISTINCT op.order_number) as order_history
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code  
      WHERE p.name_normalized LIKE ?
      GROUP BY p.product_code, p.name, p.manufacturer
      ORDER BY 
        frequency DESC,
        last_purchased DESC
      LIMIT ?
    `);

    const recentCutoff = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const searchPattern = `%${searchTerm.toLowerCase()}%`;

    const results = stmt.all(recentCutoff, searchPattern, maxResults) as any[];

    return results.map((row) => ({
      productCode: row.product_code,
      name: row.name,
      manufacturer: row.manufacturer,
      frequency: row.frequency,
      lastPurchased: row.last_purchased,
      recentPurchases: row.recent_purchases,
      orderHistory: row.order_history ? row.order_history.split(",") : [],
    }));
  }

  // Enhanced smart search with scoring algorithm
  async smartSearchProducts(
    searchTerm: string,
    maxResults: number = 5,
  ): Promise<
    Array<{
      productCode: string;
      name: string;
      manufacturer: string | null;
      frequency: number;
      lastPurchased: number;
      recentPurchases: number;
      score: number;
    }>
  > {
    await this.ensureInitialized();
    const stmt = this.db.prepare(`
      SELECT 
        p.product_code,
        p.name,
        p.manufacturer,
        COUNT(*) as frequency,
        MAX(op.purchased_at) as last_purchased,
        SUM(CASE WHEN op.purchased_at > ? THEN 1 ELSE 0 END) as recent_purchases,
        -- Scoring algorithm
        (
          -- Frequency score (higher is better)
          (COUNT(*) * 10) +
          -- Recency score (recent purchases boost score)
          (SUM(CASE WHEN op.purchased_at > ? THEN 5 ELSE 0 END)) +
          -- Exact match bonus
          (CASE 
            WHEN LOWER(p.name) LIKE ? THEN 20 
            WHEN LOWER(p.name) LIKE ? THEN 15
            ELSE 0 
          END)
        ) as score
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code  
      WHERE p.name_normalized LIKE ?
      GROUP BY p.product_code, p.name, p.manufacturer
      ORDER BY 
        score DESC,
        frequency DESC,
        last_purchased DESC
      LIMIT ?
    `);

    const recentCutoff = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const searchPattern = `%${searchTerm.toLowerCase()}%`;
    const exactMatch = searchTerm.toLowerCase();
    const startsWith = `${searchTerm.toLowerCase()}%`;

    const results = stmt.all(
      recentCutoff,
      recentCutoff,
      exactMatch,
      startsWith,
      searchPattern,
      maxResults,
    ) as any[];

    return results.map((row) => ({
      productCode: row.product_code,
      name: row.name,
      manufacturer: row.manufacturer,
      frequency: row.frequency,
      lastPurchased: row.last_purchased,
      recentPurchases: row.recent_purchases,
      score: row.score,
    }));
  }

  // Get frequently purchased products (for suggestions)
  getFrequentProducts(maxResults: number = 10): Array<{
    productCode: string;
    name: string;
    manufacturer: string | null;
    frequency: number;
    lastPurchased: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        p.product_code,
        p.name,
        p.manufacturer,
        COUNT(*) as frequency,
        MAX(op.purchased_at) as last_purchased
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code  
      GROUP BY p.product_code, p.name, p.manufacturer
      ORDER BY frequency DESC, last_purchased DESC
      LIMIT ?
    `);

    const results = stmt.all(maxResults) as any[];
    return results.map((row) => ({
      productCode: row.product_code,
      name: row.name,
      manufacturer: row.manufacturer,
      frequency: row.frequency,
      lastPurchased: row.last_purchased,
    }));
  }

  // Search by category
  searchProductsByCategory(
    categoryName: string,
    maxResults: number = 10,
  ): Array<{
    productCode: string;
    name: string;
    manufacturer: string | null;
    frequency: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        p.product_code,
        p.name,
        p.manufacturer,
        COUNT(*) as frequency
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE c.name_normalized LIKE ?
      GROUP BY p.product_code, p.name, p.manufacturer
      ORDER BY frequency DESC
      LIMIT ?
    `);

    const searchPattern = `%${categoryName.toLowerCase()}%`;
    const results = stmt.all(searchPattern, maxResults) as any[];

    return results.map((row) => ({
      productCode: row.product_code,
      name: row.name,
      manufacturer: row.manufacturer,
      frequency: row.frequency,
    }));
  }

  // Vector search methods
  async vectorSearchProducts(
    searchTerm: string,
    maxResults: number = 5,
  ): Promise<
    Array<{
      productCode: string;
      name: string;
      manufacturer: string | null;
      similarity: number;
      frequency?: number;
    }>
  > {
    await this.ensureInitialized();

    // Return empty results if vector support is not available
    if (!this.vectorSupport) {
      console.log(
        "Vector search requested but sqlite-vec not available, returning empty results",
      );
      return [];
    }

    try {
      // Generate embedding for search term
      const { generateEmbedding } = await getEmbeddingUtils();
      const searchEmbedding = await generateEmbedding(searchTerm);
      const searchArray = `[${Array.from(searchEmbedding).join(",")}]`;

      // Perform vector similarity search using vec0 syntax
      const stmt = this.db.prepare(`
        SELECT 
          pv.product_code,
          p.name,
          p.manufacturer,
          distance as similarity_distance
        FROM product_vectors pv
        JOIN products p ON pv.product_code = p.product_code
        WHERE pv.name_embedding MATCH ?
        AND k = ?
        ORDER BY distance ASC
      `);

      const results = stmt.all(searchArray, maxResults) as any[];

      // Convert distance to similarity score (smaller distance = higher similarity)
      return results.map((row) => ({
        productCode: row.product_code,
        name: row.name,
        manufacturer: row.manufacturer,
        similarity: Math.max(0, 1 - row.similarity_distance / 2), // Normalize distance to similarity (0-1)
      }));
    } catch (error) {
      console.error("Error in vector search:", error);
      return [];
    }
  }

  // Hybrid search combining text and vector results
  async hybridSearchProducts(
    searchTerm: string,
    maxResults: number = 5,
  ): Promise<
    Array<{
      productCode: string;
      name: string;
      manufacturer: string | null;
      score: number;
      frequency: number;
      similarity: number;
      source: "text" | "vector" | "both";
    }>
  > {
    await this.ensureInitialized();
    try {
      // Get text-based results
      const textResults = await this.smartSearchProducts(
        searchTerm,
        maxResults * 2,
      );

      // Get vector-based results
      const vectorResults = await this.vectorSearchProducts(
        searchTerm,
        maxResults * 2,
      );

      // Merge results by product code
      const mergedResults = new Map<string, any>();

      // Add text results
      textResults.forEach((result) => {
        mergedResults.set(result.productCode, {
          productCode: result.productCode,
          name: result.name,
          manufacturer: result.manufacturer,
          textScore: result.score,
          frequency: result.frequency,
          similarity: 0,
          source: "text" as const,
        });
      });

      // Add vector results and merge with text results
      vectorResults.forEach((result) => {
        const existing = mergedResults.get(result.productCode);
        if (existing) {
          // Combine text and vector scores
          existing.similarity = result.similarity;
          existing.source = "both";
        } else {
          mergedResults.set(result.productCode, {
            productCode: result.productCode,
            name: result.name,
            manufacturer: result.manufacturer,
            textScore: 0,
            frequency: 0,
            similarity: result.similarity,
            source: "vector" as const,
          });
        }
      });

      // Calculate combined score and sort
      const finalResults = Array.from(mergedResults.values()).map((item) => ({
        productCode: item.productCode,
        name: item.name,
        manufacturer: item.manufacturer,
        score: item.textScore * 0.6 + item.similarity * 100 * 0.4, // Weighted combination
        frequency: item.frequency,
        similarity: item.similarity,
        source: item.source,
      }));

      return finalResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    } catch (error) {
      console.error("Error in hybrid search:", error);
      // Fallback to text-only search
      return (await this.smartSearchProducts(searchTerm, maxResults)).map(
        (result) => ({
          ...result,
          similarity: 0,
          source: "text" as const,
        }),
      );
    }
  }

  // Get statistics including vector data
  async getStats(): Promise<{
    sessions: number;
    cachedOrders: number;
    relationalOrders: number;
    products: number;
    categories: number;
    embeddedProducts: number;
    vectorRecords: number;
  }> {
    await this.ensureInitialized();
    const sessionsStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?",
    );
    const legacyCacheStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM order_cache WHERE expires_at > ?",
    );
    const ordersStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE expires_at > ?",
    );
    const productsStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM products",
    );
    const categoriesStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM categories",
    );
    const embeddedProductsStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM products WHERE name_embedding IS NOT NULL",
    );
    const vectorRecordsStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM product_vectors",
    );

    const now = Date.now();
    const sessions = (sessionsStmt.get(now) as any).count;
    const cachedOrders = (legacyCacheStmt.get(now) as any).count;
    const relationalOrders = (ordersStmt.get(now) as any).count;
    const products = (productsStmt.get() as any).count;
    const categories = (categoriesStmt.get() as any).count;
    const embeddedProducts = (embeddedProductsStmt.get() as any).count;
    const vectorRecords = (vectorRecordsStmt.get() as any).count;

    return {
      sessions,
      cachedOrders,
      relationalOrders,
      products,
      categories,
      embeddedProducts,
      vectorRecords,
    };
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
}

// Global database instance
let _willysDatabase: WillysDatabase | null = null;

export function getWillysDatabase(): WillysDatabase {
  if (!_willysDatabase) {
    _willysDatabase = new WillysDatabase();
    _willysDatabase.ensureInitialized();
  }
  return _willysDatabase;
}

// For backwards compatibility
export const willysDatabase = getWillysDatabase();

// Graceful shutdown (only in Node.js environment)
if (typeof process !== "undefined" && process.versions?.node) {
  process.on("exit", () => {
    if (_willysDatabase?.initialized) {
      _willysDatabase.close();
    }
  });

  process.on("SIGINT", () => {
    if (_willysDatabase?.initialized) {
      _willysDatabase.close();
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    if (_willysDatabase?.initialized) {
      _willysDatabase.close();
    }
    process.exit(0);
  });
}
