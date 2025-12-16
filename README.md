🏷️ Auction Platform – Backend API

A production-ready backend for a real-time auction platform built with Node.js, Express, MongoDB, Socket.IO, and JWT authentication.
Supports traditional, reverse, and sealed auctions, real-time bidding, seller inventory management, and email notifications.

⸻

🚀 Tech Stack
	•	Node.js
	•	Express.js
	•	MongoDB + Mongoose
	•	JWT Authentication
	•	Socket.IO (Real-time bids & auction events)
	•	Nodemailer (Email notifications)
	•	node-cron (Auction scheduler)
	•	Multer (Image upload)
	•	dotenv

⸻

📦 Features

🔐 Authentication & Authorization
	•	User & Seller registration/login
	•	JWT-based authentication
	•	Role-based access control (buyer / seller)

🛒 Product Management (Seller)
	•	Create, update, delete products
	•	Image upload support
	•	Inventory tracking
	•	Unsold product management

⏱️ Auction System
	•	Create auctions with:
	•	Traditional auction (highest bid wins)
	•	Reverse auction (lowest bid wins)
	•	Sealed auction (hidden bids until end)
	•	Auto start & auto close using scheduler
	•	Manual close by seller
	•	Re-list unsold items

💸 Bidding Engine
	•	Atomic bid placement using MongoDB transactions
	•	Minimum increment validation
	•	Anti-sniping extension logic
	•	Real-time bid updates via Socket.IO

🔔 Notifications
	•	Email alerts when a user is outbid
	•	Winner notification after auction close
	•	Notification preferences per user

📊 Dashboards
	•	Buyer bid summary & history
	•	Seller auction overview
	•	Inventory status tracking

⸻

🗂️ Project Structure

Backend/
├── src/
│   ├── config/
│   │   ├── cloudinary.js
│   │   ├── db.js
│   ├── controllers/
│   │   ├── auctionController.js
│   │   ├── bidController.js
│   │   ├── bidHistoryController.js
│   │   ├── productController.js
│   │   ├── profileController.js
│   │   ├── userController.js
│   ├── models/
│   │   ├── Auction.js
│   │   ├── Bid.js
│   │   ├── Product.js
│   │   ├── User.js
│   ├── routes/
│   │   ├── auctionRoutes.js
│   │   ├── authRoutes.js
│   │   ├── bidRoutes.js
│   │   ├── productRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── userRoutes.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   ├── upload.js
│   ├── utils/
│   │   ├── mailer.js
│   │   ├── scheduler.js
│   ├── socket.js
│   └── index.js
├── .env
├── package.json
└── README.md


▶️ Running the Server
   npm install

Start development server
  npm run dev

Production
  npm start
Server will run on:
  http://localhost:1997


Real-Time Socket Events

Client → Server
	•	joinAuction(auctionId)
	•	leaveAuction(auctionId)

Server → Client
	•	newBid
	•	auctionClosed


Auth

  POST   /api/auth/register
  POST   /api/auth/login

Products (Seller)

  GET    /api/products
  POST   /api/products
  PUT    /api/products/:id
  DELETE /api/products/:id

Auctions  

  GET    /api/auctions
  GET    /api/auctions/:id
  POST   /api/auctions
  PUT    /api/auctions/:id/close
  POST   /api/auctions/relist

Bids

  POST   /api/bids
GET    /api/bids/:auctionId
GET    /api/bids/summary



⏱️ Auction Scheduler
	•	Runs every minute
	•	Automatically:
	•	Closes ended auctions
	•	Determines winner
	•	Updates inventory
	•	Sends email notifications
	•	Emits socket events

⸻

🛡️ Security & Reliability
	•	JWT authentication
	•	MongoDB transactions for bids
	•	Input validation at API level
	•	Defensive checks for auction state
	•	Graceful failure handling

⸻

🧪 Tested Scenarios

✔ Concurrent bids
✔ Auction auto close
✔ Manual close
✔ Inventory decrement
✔ Reverse & sealed auctions
✔ Outbid email notification

⸻

📌 Notes
	•	This project is open-source
	•	Built strictly for assessment purposes
	•	No company names referenced in codebase

⸻

👨‍💻 Author

Velubharathi
Full-Stack MERN Developer

⸻

