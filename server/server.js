const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/student.routes");
const teacherRoutes = require("./routes/teacher.routes");
const adminRoutes = require("./routes/admin.routes");
const lmsRoutes = require("./routes/lms.routes");
const classroomRoutes = require("./routes/classroom.routes");
const notesRoutes = require("./routes/notes.routes");
const assignmentsRoutes = require("./routes/assignments.routes");
const notificationsRoutes = require("./routes/notifications.routes");

const { setupSocket } = require("./socket");


// ============================================================
// EXPRESS APPLICATION
// ============================================================

const app = express();


// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(app);


// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


// ============================================================
// REQUEST LOGGER
// ============================================================

app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});


// ============================================================
// UPLOADS
// ============================================================

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);


// ============================================================
// SOCKET.IO
// ============================================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

setupSocket(io);


// ============================================================
// HOME / HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
    res.status(200).json({
        message: "School Portal API is running",
        status: "success"
    });
});


// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api/students", studentRoutes);

app.use("/api/teachers", teacherRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/lms", lmsRoutes);

app.use("/api/classroom", classroomRoutes);

app.use("/api/notes", notesRoutes);

app.use("/api/assignments", assignmentsRoutes);

app.use("/api/notifications", notificationsRoutes);


// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found",
        path: req.originalUrl
    });
});


// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
    console.error("Server Error:", err);

    res.status(err.status || 500).json({
        message: err.message || "Internal server error"
    });
});


// ============================================================
// PORT
// ============================================================

const PORT = process.env.PORT || 5000;


// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
    console.log("");
    console.log("========================================");
    console.log("       SCHOOL PORTAL SERVER");
    console.log("========================================");
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📡 Socket.IO enabled`);
    console.log("========================================");
    console.log("");
});


// ============================================================
// SERVER ERROR HANDLING
// ============================================================

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(
            `❌ Port ${PORT} is already in use.`
        );

        console.error(
            `Stop the existing server using port ${PORT}, then run npm run dev again.`
        );

        process.exit(1);
    }

    console.error("❌ Server error:", error);
});