import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import db from "./config/db.ts";
import { availableParallelism } from "node:os";
import cluster from "cluster";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";

if (cluster.isPrimary) {
	const numCPUs = availableParallelism();
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork({
			PORT: 3000 + i,
		});
	}
	setupPrimary();
} else {
	await db.exec(`
   CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`);

	const app = express();
	const server = createServer(app);
	const io = new Server(server, {
		connectionStateRecovery: {},
		adapter: createAdapter(),
	});

	const __dirname = dirname(fileURLToPath(import.meta.url));

	const PORT = process.env.PORT || 3000;

	app.get("/", (req, res) => {
		res.sendFile(join(__dirname, "index.html"));
	});

	io.on("connection", async (socket) => {
		console.log("a user connected");
		socket.broadcast.emit("connected", "*user joined*");

		socket.on("disconnect", () => {
			console.log("user disconnected");
			socket.broadcast.emit("disconnected", "*user disconnected*");
		});

		socket.on("chat message", async (msg, clientOffset, callback) => {
			// let result: ISqlite.RunResult<Statement>;
			let result: any;
			try {
				result = await db.run(
					"INSERT INTO messages (content, client_offset) VALUES (?,?)",
					msg,
					clientOffset,
				);
			} catch (error) {
				if (error.errno === 19 /* sqlite_constraints */) {
					// message was already inserted so we notify the client
					callback();
				} else {
					// let the client retry
				}
				return;
			}
			io.emit("chat message", msg, result.lastID);
			callback();
		});

		if (!socket.recovered) {
			try {
				await db.each(
					"SELECT id, content FROM messages WHERE id > ?",
					[socket.handshake.auth.serverOffset || 0],
					(_err, row) => {
						socket.emit("chat message", row.content, row.id);
					},
				);
			} catch (error) {
				console.log(error);
			}
		}
	});

	server.listen(PORT, () => {
		console.log(`server is running at http://localhost:${PORT}`);
	});
}
