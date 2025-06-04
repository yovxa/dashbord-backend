const express = require("express");
const sql = require("mysql");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static("public"));

const db = sql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
  console.log("Connected to database.");
});

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Root route
app.get("/", (req, res) => {
  res.json("Backend side operational");
});

app.post("/orders", (req, res) => {
  const {
    PhoneNumber,
    Address,
    Payment,
    Name,
    Street,
    BuildingNumber,
    UserID,
    CartID,
    Status,
  } = req.body;

  if (
    !PhoneNumber ||
    !Address ||
    !Payment ||
    !Name ||
    !Street ||
    !BuildingNumber ||
    !UserID ||
    !CartID
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query =
    "INSERT INTO orders (PhoneNumber, Address, Payment, Name, Street, BuildingNumber, UserID, CartID, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  db.query(
    query,
    [
      PhoneNumber,
      Address,
      Payment,
      Name,
      Street,
      BuildingNumber,
      UserID,
      CartID,
      Status || "Pending",
    ],
    (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({ message: "Error inserting data" }); // Return JSON with message
      }
      res.status(200).json({ message: "Data inserted successfully" }); // Return JSON response
    }
  );
});

app.get("/orders", (req, res) => {
  const sql = "SELECT * FROM orders";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.put("/orders/:id", (req, res) => {
  const { Status } = req.body;
  const { id } = req.params;

  console.log("Received data:", { id, Status });

  if (!Status || !id) {
    console.error("Missing data:", { id, Status });
    return res.status(400).json({ error: "Invalid data provided" });
  }

  const updateSql = "UPDATE orders SET Status = ? WHERE OrderID = ?";
  db.query(updateSql, [Status, id], (err) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to update status" });
    }
    console.log("Rows updated:", this.changes);
    res.status(200).json({ message: "status updated successfully" });
  });
});

// Fetch users
app.get("/users", (req, res) => {
  const sql = "SELECT * FROM users";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// Add a new user
app.post("/users", (req, res) => {
  const { Username, Email, Password, Gender, BirthDate, Address } = req.body;

  // Validate input
  if (!Username || !Email || !Password || !Gender || !BirthDate || !Address) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO users (username, email, password, gender, birthdate, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [Username, Email, Password, Gender, BirthDate, Address],
    (err, result) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res
          .status(500)
          .json({ message: "Error creating user", error: err });
      }

      res.status(201).json({
        message: "User added successfully",
        user: { Username, Email, Gender, BirthDate, Address },
      });
    }
  );
});

// Signup route
app.post("/signup", (req, res) => {
  const { username, email, password, gender, birthdate, address } = req.body;

  // Validate input
  if (!username || !email || !password || !gender || !birthdate || !address) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Hash the password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Error hashing password", error: err });

    // Check if the email already exists
    const checkEmailSql = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmailSql, [email], (err, data) => {
      if (err) return res.status(500).json(err);

      if (data.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Insert new user with hashed password
      const insertSql = `
        INSERT INTO users (username, email, password, gender, birthdate, address) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [username, email, hashedPassword, gender, birthdate, address],
        (err, result) => {
          if (err) return res.status(500).json(err);

          res.status(201).json({ message: "User registered successfully" });
        }
      );
    });
  });
});

// Get row counts for users, staff, branch, and store
app.get("/row-counts", (req, res) => {
  const queries = [
    "SELECT COUNT(*) AS Users FROM users",
    "SELECT COUNT(*) AS Staff FROM staff",
    "SELECT COUNT(*) AS Pharmacies FROM branch",
    "SELECT COUNT(*) AS Store FROM store",
    "SELECT COUNT(*) AS product FROM product",
    "SELECT COUNT(*) AS orders FROM orders",
  ];

  const results = [];

  // Function to execute queries and push results to results array
  const executeQuery = (index, sql) => {
    db.query(sql, (err, data) => {
      if (err) return res.status(500).json(err);
      results[index] = data[0];

      // If all queries are complete, return the results
      if (results.length === queries.length) {
        res.json(results);
      }
    });
  };

  // Execute each query
  queries.forEach((query, index) => executeQuery(index, query));
});

// Fetch staff
app.get("/staff", (req, res) => {
  const sql = "SELECT * FROM staff";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// Fetch branches
app.get("/branch", (req, res) => {
  const sql = "SELECT * FROM branch";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// Fetch stores
app.get("/store", (req, res) => {
  const sql = "SELECT * FROM store";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});
// Add a product to the store
app.post("/store", (req, res) => {
  const { BranchID, Name, Expiry_date, Manufactorer, Stock, Price } = req.body;

  if (!BranchID || !Name || !Expiry_date || !Manufactorer || !Stock || !Price) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO store (BranchID, Name, Expiry_date, Manufactorer, Stock, Price) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [BranchID, Name, Expiry_date, Manufactorer, Stock, Price],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({
        message: "Product added successfully",
        product: { BranchID, Name, Expiry_date, Manufactorer, Stock, Price },
      });
    }
  );
});

// Delete a product by ID
app.delete("/store/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Product ID is required" });
  }

  const sql = "DELETE FROM store WHERE StoreID = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting product:", err);
      return res.status(500).json({ message: "Failed to delete product" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  });
});
// DELETE user by Username
app.delete("/users/:username", (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  const sql = "DELETE FROM users WHERE Username = ?";
  db.query(sql, [username], (err, result) => {
    if (err) {
      console.error("Error deleting user:", err);
      return res.status(500).json({ message: "Failed to delete user" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  });
});
app.delete("/product/:name", (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ message: "Product Name is required" });
  }

  const sql = "DELETE FROM product WHERE Name = ?";
  db.query(sql, [name], (err, result) => {
    if (err) {
      console.error("Error deleting product:", err);
      return res.status(500).json({ message: "Failed to delete product" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  });
});
app.delete("/branch/:PName", (req, res) => {
  const { PName } = req.params;

  if (!PName) {
    return res.status(400).json({ message: "Pharmacy Name is required" });
  }

  const sql = "DELETE FROM branch WHERE PName = ?";
  db.query(sql, [PName], (err, result) => {
    if (err) {
      console.error("Error deleting pharmacy:", err);
      return res.status(500).json({ message: "Failed to delete pharmacy" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    res.status(200).json({ message: "Pharmacy deleted successfully" });
  });
});

app.post("/branch", (req, res) => {
  const { PName, Location, Location_Link } = req.body;

  if (!PName || !Location || !Location_Link) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO branch (PName, Location,Location_Link) 
    VALUES (?, ?, ?)
  `;

  db.query(sql, [PName, Location, Location_Link], (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({
      message: "Branch added successfully",
      branch: { PName, Location, Location_Link },
    });
  });
});
app.post("/staff", (req, res) => {
  const { Username, Email, Password, Role, BranchID } = req.body;

  if (
    !Username ||
    !Email ||
    !Password ||
    !Role ||
    (Role !== "Admin" && !BranchID)
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO staff (Username, Email, Password, Role, BranchID)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [Username, Email, Password, Role, BranchID || null],
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.status(201).json({
        message: "Staff added successfully",
        staff: { Username, Email, Password, Role, BranchID },
      });
    }
  );
});

// Fetch products
app.get("/product", (req, res) => {
  const sql = "SELECT * FROM product";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.post("/product", (req, res) => {
  const { Name, Expiry_date, Stock, Mg, Category, Description, Price } =
    req.body;

  if (
    !Name ||
    !Expiry_date ||
    !Stock ||
    !Mg ||
    !Category ||
    !Description ||
    !Price
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO product (Name, Expiry_date, Stock, Mg, Category, Description, Price) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [Name, Expiry_date, Stock, Mg, Category, Description, Price],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({
        message: "Branch added successfully",
        branch: { Name, Expiry_date, Stock, Mg, Category, Description, Price },
      });
    }
  );
});

app.get("/search/medicine", (req, res) => {
  const { name, place } = req.query;

  if (!name || !place) {
    return res
      .status(400)
      .json({ message: "Medicine name and place are required" });
  }

  const sql = `
    SELECT 
      b.BranchID, 
      b.PName AS BranchName, 
      b.Location, 
      b.Location_Link,
      s.StoreID, 
      s.Name AS MedicineName, 
      s.Expiry_date, 
      s.Manufactorer, 
      s.Stock, 
      s.Price,
      s.Image
    FROM 
      Branch b
    JOIN 
      Store s 
    ON 
      b.BranchID = s.BranchID
    WHERE 
      s.Name LIKE ? AND b.Location LIKE ?`;

  db.query(sql, [`%${name}%`, `%${place}%`], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// Fetch cart details
app.get("/cart", (req, res) => {
  const userID = req.query.UserID;
  const sql = `
    SELECT c.CartID, c.ProductID, c.Quantity, c.Total_price, c.UserID, 
           p.Name, p.Image, p.Price
    FROM cart c
    JOIN product p ON c.ProductID = p.ProductID
    WHERE c.UserID = ?`;
  db.query(sql, [userID], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// Add item to cart or update existing item
app.post("/cart", (req, res) => {
  const { ProductID, userID, Quantity } = req.body;

  if (!ProductID || !userID || !Quantity) {
    return res
      .status(400)
      .json({ message: "ProductID, userID, and Quantity are required" });
  }

  const checkSql = "SELECT * FROM cart WHERE ProductID = ? AND userID = ?";
  db.query(checkSql, [ProductID, userID], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length > 0) {
      // Update existing item
      const newQuantity = result[0].Quantity + Quantity;
      const totalPrice = newQuantity * result[0].Price;
      const updateSql = `
        UPDATE cart 
        SET Quantity = ?, Total_price = ? 
        WHERE ProductID = ? AND userID = ?`;
      db.query(
        updateSql,
        [newQuantity, totalPrice, ProductID, userID],
        (err) => {
          if (err) return res.status(500).json(err);
          res.json({ message: "Cart updated successfully" });
        }
      );
    } else {
      // Insert new item
      const getPriceSql = "SELECT Price FROM product WHERE ProductID = ?";
      db.query(getPriceSql, [ProductID], (err, productData) => {
        if (err) return res.status(500).json(err);
        const totalPrice = Quantity * productData[0].Price;
        const insertSql = `
          INSERT INTO cart (ProductID, userID, Quantity, Total_price) 
          VALUES (?, ?, ?, ?)`;
        db.query(
          insertSql,
          [ProductID, userID, Quantity, totalPrice],
          (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Item added to cart" });
          }
        );
      });
    }
  });
});

// Update cart item quantity
app.put("/cart", (req, res) => {
  const { CartID, Quantity, userID } = req.body;

  if (!CartID || !Quantity || !userID) {
    return res
      .status(400)
      .json({ message: "CartID and Quantity are required" });
  }

  const updateSql = `
    UPDATE cart 
    SET Quantity = ?, Total_price = Quantity * (SELECT Price FROM product WHERE ProductID = cart.ProductID)
    WHERE CartID = ?`;
  db.query(updateSql, [Quantity, CartID, userID], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Quantity updated" });
  });
});

// Delete a cart item
app.delete("/cart/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "CartID is required" });
  }

  const deleteSql = "DELETE FROM cart WHERE CartID = ?";
  db.query(deleteSql, [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Item removed from cart" });
  });
});

// User login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, data) => {
    if (err) return res.status(500).json(err);

    if (data.length > 0) {
      res.status(200).json({ message: "Login successful", user: data[0] });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  });
});

app.post("/dashboard_login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const sql = "SELECT * FROM staff WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, data) => {
    if (err) return res.status(500).json(err);

    if (data.length > 0) {
      res.status(200).json({ message: "Login successful", user: data[0] });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  });
});

// Start server
app.listen(8081, () => {
  console.log("Server running on http://localhost:8081");
});
